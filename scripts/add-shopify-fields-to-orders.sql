-- Add Shopify-related fields to the orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shopify_order_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_connection_id UUID,
ADD COLUMN IF NOT EXISTS shopify_fulfillment_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_fulfilled_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_shopify_order_id ON orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_connection_id ON orders(shopify_connection_id);

-- Add comment to explain the purpose of these fields
COMMENT ON COLUMN orders.shopify_order_id IS 'Shopify order ID for orders synced from Shopify';
COMMENT ON COLUMN orders.shopify_connection_id IS 'Reference to the shopify_connections table';
COMMENT ON COLUMN orders.shopify_fulfillment_id IS 'Shopify fulfillment ID when order is fulfilled in Shopify';
COMMENT ON COLUMN orders.shopify_fulfilled_at IS 'Timestamp when the order was fulfilled in Shopify';
