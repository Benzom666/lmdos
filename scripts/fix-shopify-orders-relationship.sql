-- Fix the relationship between orders and shopify_connections tables

-- First, ensure the shopify_connection_id column exists in orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shopify_connection_id UUID REFERENCES shopify_connections(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_shopify_connection_id 
ON orders(shopify_connection_id) 
WHERE shopify_connection_id IS NOT NULL;

-- Update existing Shopify orders to have the connection ID
-- This will link orders to their Shopify connections based on matching criteria
UPDATE orders 
SET shopify_connection_id = (
  SELECT sc.id 
  FROM shopify_connections sc 
  WHERE sc.is_active = true 
  AND orders.source = 'shopify'
  AND orders.shopify_order_id IS NOT NULL
  LIMIT 1
)
WHERE orders.source = 'shopify' 
AND orders.shopify_connection_id IS NULL 
AND orders.shopify_order_id IS NOT NULL;

-- Add a constraint to ensure Shopify orders have a connection ID
ALTER TABLE orders 
ADD CONSTRAINT check_shopify_orders_have_connection 
CHECK (
  (source != 'shopify') OR 
  (source = 'shopify' AND shopify_connection_id IS NOT NULL)
);

-- Create a view for easier querying of orders with their Shopify connections
CREATE OR REPLACE VIEW orders_with_shopify_connection AS
SELECT 
  o.*,
  sc.shop_domain,
  sc.access_token,
  sc.is_active as connection_active,
  sc.settings as connection_settings
FROM orders o
LEFT JOIN shopify_connections sc ON o.shopify_connection_id = sc.id
WHERE o.source = 'shopify' OR o.shopify_connection_id IS NOT NULL;

-- Grant permissions
GRANT SELECT ON orders_with_shopify_connection TO service_role;
GRANT SELECT ON orders_with_shopify_connection TO authenticated;

-- Add RLS policy for the view
ALTER VIEW orders_with_shopify_connection SET (security_invoker = true);
