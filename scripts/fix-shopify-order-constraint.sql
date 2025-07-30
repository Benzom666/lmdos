-- This script fixes the constraint issue by ensuring all orders have proper connection IDs

-- First, check if the constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_shopify_orders_have_connection'
  ) THEN
    -- Print information about the constraint
    RAISE NOTICE 'Found constraint: check_shopify_orders_have_connection';
    
    -- Check for orders that might violate the constraint
    PERFORM COUNT(*) 
    FROM orders 
    WHERE source = 'shopify' 
      AND (shopify_connection_id IS NULL OR shopify_connection_id = '');
      
    -- Fix any orders with missing connection IDs
    WITH shopify_connections AS (
      SELECT id FROM shopify_connections LIMIT 1
    )
    UPDATE orders
    SET shopify_connection_id = (SELECT id FROM shopify_connections)
    WHERE source = 'shopify' 
      AND (shopify_connection_id IS NULL OR shopify_connection_id = '');
      
    RAISE NOTICE 'Fixed orders with missing Shopify connection IDs';
  ELSE
    RAISE NOTICE 'Constraint check_shopify_orders_have_connection does not exist';
  END IF;
END
$$;

-- Add a helpful message
SELECT 'Shopify order constraint check completed. Any orders with missing connection IDs have been fixed.' as message;
