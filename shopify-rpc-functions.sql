-- Ensure we are working in the public schema
SET search_path = public;

-- Function to check if a Shopify order exists
DROP FUNCTION IF EXISTS check_shopify_order_exists(TEXT, UUID);
CREATE OR REPLACE FUNCTION check_shopify_order_exists(
  p_shopify_order_id TEXT,
  p_connection_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_exists BOOLEAN := FALSE;
BEGIN
  -- Explicitly use public schema for the table
  SELECT EXISTS(
    SELECT 1 FROM public.shopify_orders
    WHERE shopify_order_id = p_shopify_order_id
    AND shopify_connection_id = p_connection_id
  ) INTO order_exists;

  RETURN order_exists;
END;
$$;

-- Function to insert a Shopify order (bypasses RLS)
DROP FUNCTION IF EXISTS insert_shopify_order(JSONB);
CREATE OR REPLACE FUNCTION insert_shopify_order(p_data JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  -- Explicitly use public schema for the table
  INSERT INTO public.shopify_orders (
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
    (p_data->>'shopify_connection_id')::UUID,
    p_data->>'shopify_order_id',
    p_data->>'order_number',
    p_data->>'customer_name',
    p_data->>'customer_email',
    p_data->>'customer_phone',
    p_data->'shipping_address',
    p_data->'line_items',
    (p_data->>'total_price')::DECIMAL(10,2),
    p_data->>'fulfillment_status',
    p_data->>'financial_status',
    (p_data->>'created_at')::TIMESTAMP WITH TIME ZONE,
    (p_data->>'synced_at')::TIMESTAMP WITH TIME ZONE
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_shopify_order_exists(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_shopify_order_exists(TEXT, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION insert_shopify_order(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_shopify_order(JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
