-- Remove SH- prefix from all order numbers to match Shopify format
-- Only update tables that exist

-- Update orders table
UPDATE orders 
SET order_number = REPLACE(order_number, 'SH-', '')
WHERE order_number LIKE 'SH-%';

-- Update shopify_orders table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shopify_orders') THEN
        UPDATE shopify_orders 
        SET order_number = REPLACE(order_number, 'SH-', '')
        WHERE order_number LIKE 'SH-%';
        RAISE NOTICE 'Updated shopify_orders table';
    ELSE
        RAISE NOTICE 'shopify_orders table does not exist, skipping';
    END IF;
END $$;

-- Update sync queue if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shopify_sync_queue') THEN
        UPDATE shopify_sync_queue 
        SET payload = jsonb_set(
          payload, 
          '{order_number}', 
          to_jsonb(REPLACE(payload->>'order_number', 'SH-', ''))
        )
        WHERE payload->>'order_number' LIKE 'SH-%';
        RAISE NOTICE 'Updated shopify_sync_queue table';
    ELSE
        RAISE NOTICE 'shopify_sync_queue table does not exist, skipping';
    END IF;
END $$;

-- Show the updated orders
SELECT 
    id, 
    order_number, 
    source, 
    shopify_order_id, 
    status,
    CASE 
        WHEN order_number ~ '^[0-9]+$' THEN 'Clean ✓'
        ELSE 'Needs cleanup ✗'
    END as number_format
FROM orders 
WHERE source = 'shopify' 
ORDER BY created_at DESC 
LIMIT 10;

-- Show summary
SELECT 
    COUNT(*) as total_shopify_orders,
    COUNT(CASE WHEN order_number LIKE 'SH-%' THEN 1 END) as orders_with_prefix,
    COUNT(CASE WHEN order_number ~ '^[0-9]+$' THEN 1 END) as clean_orders
FROM orders 
WHERE source = 'shopify';
