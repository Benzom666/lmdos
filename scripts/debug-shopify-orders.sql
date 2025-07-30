-- Debug script to check Shopify orders data
-- This will help us see what's in the database

-- Check if shopify_orders table exists and has data
SELECT 'shopify_orders table' as table_name, count(*) as record_count 
FROM shopify_orders;

-- Check recent shopify_orders
SELECT 
  id,
  shopify_connection_id,
  order_number,
  customer_name,
  total_price,
  created_at,
  synced_at
FROM shopify_orders 
ORDER BY synced_at DESC 
LIMIT 10;

-- Check shopify_connections
SELECT 
  id,
  admin_id,
  shop_domain,
  is_active,
  orders_synced,
  last_sync
FROM shopify_connections;

-- Check if any delivery orders were created from Shopify
SELECT 
  id,
  order_number,
  customer_name,
  status,
  created_by,
  created_at
FROM orders 
WHERE order_number LIKE 'SH-%'
ORDER BY created_at DESC
LIMIT 10;
