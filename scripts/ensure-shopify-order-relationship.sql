-- Ensure proper indexing for the relationship between shopify_orders and orders
-- This will help with performance when joining these tables

-- Add index on orders.external_order_id and source for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_external_order_source 
ON orders(external_order_id, source) 
WHERE external_order_id IS NOT NULL AND source IS NOT NULL;

-- Add index on shopify_orders.shopify_order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopify_orders_shopify_order_id 
ON shopify_orders(shopify_order_id);

-- Add a composite index for better performance on connection-based queries
CREATE INDEX IF NOT EXISTS idx_shopify_orders_connection_created 
ON shopify_orders(shopify_connection_id, created_at DESC);

-- Update the orders table to ensure external_order_id is properly set for Shopify orders
-- This will help maintain the relationship between the tables
UPDATE orders 
SET external_order_id = shopify_order_id 
WHERE source = 'shopify' 
AND external_order_id IS NULL 
AND shopify_order_id IS NOT NULL;

-- Add a check constraint to ensure consistency
ALTER TABLE orders 
ADD CONSTRAINT check_shopify_external_order_id 
CHECK (
  (source != 'shopify') OR 
  (source = 'shopify' AND external_order_id IS NOT NULL)
);

-- Create a view for easier querying of Shopify orders with delivery status
CREATE OR REPLACE VIEW shopify_orders_with_delivery AS
SELECT 
  so.*,
  sc.shop_domain,
  sc.is_active as connection_active,
  o.id as delivery_order_id,
  o.order_number as delivery_order_number,
  o.status as delivery_status,
  o.completed_at as delivery_completed_at,
  o.shopify_fulfillment_id,
  o.shopify_fulfilled_at,
  CASE 
    WHEN o.status = 'delivered' AND o.shopify_fulfillment_id IS NOT NULL THEN 'fulfilled'
    WHEN o.status = 'delivered' AND o.shopify_fulfillment_id IS NULL THEN 'pending_fulfillment'
    ELSE so.fulfillment_status
  END as actual_fulfillment_status,
  CASE 
    WHEN o.status = 'delivered' AND o.shopify_fulfillment_id IS NOT NULL THEN 'synced'
    ELSE 'pending'
  END as sync_status
FROM shopify_orders so
LEFT JOIN shopify_connections sc ON so.shopify_connection_id = sc.id
LEFT JOIN orders o ON so.shopify_order_id = o.external_order_id AND o.source = 'shopify';

-- Grant permissions on the view
GRANT SELECT ON shopify_orders_with_delivery TO service_role;

-- Add RLS policy for the view
ALTER VIEW shopify_orders_with_delivery SET (security_invoker = true);
