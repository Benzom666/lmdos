-- Fix the shopify order sync counting and ensure proper order creation

-- Update the insert_shopify_order function to handle proper counting
CREATE OR REPLACE FUNCTION insert_shopify_order(p_data JSONB)
RETURNS VOID AS $$
BEGIN
  INSERT INTO shopify_orders (
    shopify_connection_id,
    shopify_order_id,
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    line_items,
    total_price,
    fulfillment_status,
    financial_status,
    created_at,
    synced_at
  ) VALUES (
    (p_data->>'shopify_connection_id')::uuid,
    p_data->>'shopify_order_id',
    p_data->>'order_number',
    p_data->>'customer_name',
    p_data->>'customer_email',
    p_data->>'customer_phone',
    (p_data->>'shipping_address')::jsonb,
    (p_data->>'line_items')::jsonb,
    (p_data->>'total_price')::decimal,
    p_data->>'fulfillment_status',
    p_data->>'financial_status',
    (p_data->>'created_at')::timestamptz,
    (p_data->>'synced_at')::timestamptz
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get accurate order counts for connections
CREATE OR REPLACE FUNCTION get_connection_order_count(connection_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM shopify_orders 
    WHERE shopify_connection_id = connection_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing connections with correct order counts
UPDATE shopify_connections 
SET orders_synced = get_connection_order_count(id)
WHERE id IN (SELECT DISTINCT shopify_connection_id FROM shopify_orders);

-- Add index for better performance on order counting
CREATE INDEX IF NOT EXISTS idx_shopify_orders_connection_id 
ON shopify_orders(shopify_connection_id);

-- Add index for better performance on order lookups
CREATE INDEX IF NOT EXISTS idx_orders_shopify_connection 
ON orders(shopify_connection_id) WHERE shopify_connection_id IS NOT NULL;
