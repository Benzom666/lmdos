-- Add fulfillment tracking fields to orders table if they don't exist
DO $$ 
BEGIN
    -- Add shopify_fulfillment_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shopify_fulfillment_id') THEN
        ALTER TABLE orders ADD COLUMN shopify_fulfillment_id TEXT;
    END IF;
    
    -- Add shopify_fulfilled_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shopify_fulfilled_at') THEN
        ALTER TABLE orders ADD COLUMN shopify_fulfilled_at TIMESTAMPTZ;
    END IF;
    
    -- Add index for better performance on Shopify order lookups
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_shopify_order_id') THEN
        CREATE INDEX idx_orders_shopify_order_id ON orders(shopify_order_id) WHERE shopify_order_id IS NOT NULL;
    END IF;
    
    -- Add index for fulfillment status queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_shopify_fulfillment') THEN
        CREATE INDEX idx_orders_shopify_fulfillment ON orders(shopify_fulfillment_id) WHERE shopify_fulfillment_id IS NOT NULL;
    END IF;
    
END $$;

-- Update RLS policies to include new fields
DROP POLICY IF EXISTS "Users can view orders based on role" ON orders;
CREATE POLICY "Users can view orders based on role" ON orders
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_profiles 
            WHERE role = 'super_admin'
        ) OR
        (auth.uid() IN (
            SELECT user_id FROM user_profiles 
            WHERE role = 'admin'
        ) AND (
            created_by = auth.uid() OR
            auth.uid() IN (
                SELECT admin_id FROM user_profiles 
                WHERE user_id = driver_id
            )
        )) OR
        (auth.uid() IN (
            SELECT user_id FROM user_profiles 
            WHERE role = 'driver'
        ) AND driver_id = auth.uid())
    );

-- Add comment for documentation
COMMENT ON COLUMN orders.shopify_fulfillment_id IS 'Shopify fulfillment ID when order is fulfilled in Shopify';
COMMENT ON COLUMN orders.shopify_fulfilled_at IS 'Timestamp when order was fulfilled in Shopify';
