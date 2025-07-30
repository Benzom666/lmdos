-- Debug script to check what orders exist and their formats

-- Check all orders in the system
SELECT 
  id,
  order_number,
  source,
  status,
  shopify_order_id,
  shopify_connection_id,
  created_at
FROM orders 
ORDER BY created_at DESC 
LIMIT 20;

-- Check specifically for Shopify orders
SELECT 
  'Shopify Orders' as category,
  COUNT(*) as count,
  MIN(order_number) as min_order_number,
  MAX(order_number) as max_order_number
FROM orders 
WHERE source = 'shopify';

-- Check for orders with different number formats
SELECT 
  'Orders with SH- prefix' as category,
  COUNT(*) as count
FROM orders 
WHERE order_number LIKE 'SH-%';

SELECT 
  'Orders with plain numbers' as category,
  COUNT(*) as count
FROM orders 
WHERE order_number ~ '^[0-9]+$';

-- Check recent Shopify orders specifically
SELECT 
  order_number,
  shopify_order_id,
  customer_name,
  status,
  created_at
FROM orders 
WHERE source = 'shopify'
ORDER BY created_at DESC 
LIMIT 10;

-- Show sample order numbers for testing
SELECT 
  'Sample order numbers for testing:' as message,
  string_agg(order_number, ', ') as order_numbers
FROM (
  SELECT order_number 
  FROM orders 
  WHERE source = 'shopify' 
  ORDER BY created_at DESC 
  LIMIT 5
) sample_orders;
