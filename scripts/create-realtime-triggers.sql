-- Create a function to handle order status changes and queue Shopify sync
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    shopify_conn_id UUID;
    sync_payload JSONB;
BEGIN
    -- Only process orders from Shopify
    IF NEW.source != 'shopify' OR NEW.external_order_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if status changed to delivered or failed
    IF (OLD.status IS DISTINCT FROM NEW.status) AND 
       (NEW.status IN ('delivered', 'failed', 'cancelled')) THEN
        
        -- Find the Shopify connection for this order
        SELECT sc.id INTO shopify_conn_id
        FROM shopify_connections sc
        JOIN shopify_orders so ON so.shopify_connection_id = sc.id
        WHERE so.shopify_order_id = NEW.external_order_id
        AND sc.is_active = true
        LIMIT 1;

        -- If we found a connection, queue the sync
        IF shopify_conn_id IS NOT NULL THEN
            -- Prepare sync payload
            sync_payload := jsonb_build_object(
                'order_id', NEW.id,
                'shopify_order_id', NEW.external_order_id,
                'new_status', NEW.status,
                'old_status', COALESCE(OLD.status, 'unknown'),
                'order_number', NEW.order_number,
                'completed_at', NEW.completed_at,
                'driver_id', NEW.driver_id
            );

            -- Determine sync type based on status
            INSERT INTO shopify_sync_queue (
                order_id,
                shopify_connection_id,
                sync_type,
                payload,
                scheduled_at
            ) VALUES (
                NEW.id,
                shopify_conn_id,
                CASE 
                    WHEN NEW.status = 'delivered' THEN 'fulfillment'
                    WHEN NEW.status IN ('failed', 'cancelled') THEN 'cancellation'
                    ELSE 'update'
                END,
                sync_payload,
                NOW()
            );

            -- Update sync status
            NEW.sync_status := 'pending';
            NEW.last_sync_attempt := NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS order_status_change_trigger ON orders;
CREATE TRIGGER order_status_change_trigger
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_status_change();

-- Create a function to notify about new sync tasks
CREATE OR REPLACE FUNCTION notify_sync_queue()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification for real-time processing
    PERFORM pg_notify('shopify_sync_queue', json_build_object(
        'id', NEW.id,
        'order_id', NEW.order_id,
        'sync_type', NEW.sync_type,
        'scheduled_at', NEW.scheduled_at
    )::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sync queue notifications
DROP TRIGGER IF EXISTS sync_queue_notify_trigger ON shopify_sync_queue;
CREATE TRIGGER sync_queue_notify_trigger
    AFTER INSERT ON shopify_sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION notify_sync_queue();

PRINT 'Real-time triggers created successfully';
