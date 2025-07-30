-- Fix delivery status schema and add missing columns
-- This script ensures all necessary columns exist for proper Shopify fulfillment sync

-- Add missing columns to orders table if they don't exist
DO $$ 
BEGIN
    -- Add completed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'completed_at') THEN
        ALTER TABLE orders ADD COLUMN completed_at TIMESTAMPTZ;
        RAISE NOTICE 'Added completed_at column to orders table';
    END IF;

    -- Add sync_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'sync_status') THEN
        ALTER TABLE orders ADD COLUMN sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'));
        RAISE NOTICE 'Added sync_status column to orders table';
    END IF;

    -- Add shopify_fulfillment_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shopify_fulfillment_id') THEN
        ALTER TABLE orders ADD COLUMN shopify_fulfillment_id TEXT;
        RAISE NOTICE 'Added shopify_fulfillment_id column to orders table';
    END IF;

    -- Add shopify_fulfilled_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shopify_fulfilled_at') THEN
        ALTER TABLE orders ADD COLUMN shopify_fulfilled_at TIMESTAMPTZ;
        RAISE NOTICE 'Added shopify_fulfilled_at column to orders table';
    END IF;

    -- Add shopify_connection_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shopify_connection_id') THEN
        ALTER TABLE orders ADD COLUMN shopify_connection_id UUID REFERENCES shopify_connections(id);
        RAISE NOTICE 'Added shopify_connection_id column to orders table';
    END IF;

    -- Add shopify_order_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shopify_order_id') THEN
        ALTER TABLE orders ADD COLUMN shopify_order_id TEXT;
        RAISE NOTICE 'Added shopify_order_id column to orders table';
    END IF;
END $$;

-- Create shopify_sync_queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS shopify_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shopify_connection_id UUID NOT NULL REFERENCES shopify_connections(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('fulfillment', 'cancellation', 'update')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    payload JSONB DEFAULT '{}',
    error_message TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopify_sync_queue_status ON shopify_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_shopify_sync_queue_scheduled ON shopify_sync_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_shopify_sync_queue_order_id ON shopify_sync_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_order_id ON orders(shopify_order_id);

-- Create trigger to automatically queue fulfillment when order is delivered
CREATE OR REPLACE FUNCTION queue_shopify_fulfillment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only queue if order is delivered and has Shopify connection
    IF NEW.status = 'delivered' AND 
       OLD.status != 'delivered' AND 
       NEW.shopify_order_id IS NOT NULL AND 
       NEW.shopify_connection_id IS NOT NULL THEN
        
        -- Insert into sync queue
        INSERT INTO shopify_sync_queue (
            order_id,
            shopify_connection_id,
            sync_type,
            payload
        ) VALUES (
            NEW.id,
            NEW.shopify_connection_id,
            'fulfillment',
            jsonb_build_object(
                'order_number', NEW.order_number,
                'shopify_order_id', NEW.shopify_order_id,
                'completed_at', NEW.completed_at
            )
        );
        
        RAISE NOTICE 'Queued fulfillment sync for order %', NEW.order_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_queue_shopify_fulfillment ON orders;
CREATE TRIGGER trigger_queue_shopify_fulfillment
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION queue_shopify_fulfillment();

-- Update existing delivered orders to have proper sync status
UPDATE orders 
SET sync_status = CASE 
    WHEN shopify_fulfillment_id IS NOT NULL THEN 'synced'
    WHEN shopify_order_id IS NOT NULL AND status = 'delivered' THEN 'pending'
    ELSE 'pending'
END
WHERE sync_status IS NULL;

-- Create function to clean up old sync queue entries
CREATE OR REPLACE FUNCTION cleanup_old_sync_queue()
RETURNS void AS $$
BEGIN
    DELETE FROM shopify_sync_queue 
    WHERE created_at < NOW() - INTERVAL '7 days' 
    AND status IN ('completed', 'failed');
    
    RAISE NOTICE 'Cleaned up old sync queue entries';
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON shopify_sync_queue TO authenticated;
GRANT ALL ON shopify_sync_queue TO service_role;

RAISE NOTICE 'Shopify fulfillment sync schema setup completed successfully';
