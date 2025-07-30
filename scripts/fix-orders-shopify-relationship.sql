-- Fix the relationship between orders and shopify_orders tables
-- This script ensures proper foreign key relationships and indexes

-- First, let's check what columns exist in the orders table
DO $$
BEGIN
    -- Add shopify_order_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shopify_order_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN shopify_order_id VARCHAR(255);
        RAISE NOTICE 'Added shopify_order_id column to orders table';
    END IF;

    -- Add shopify_connection_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shopify_connection_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN shopify_connection_id UUID REFERENCES shopify_connections(id);
        RAISE NOTICE 'Added shopify_connection_id column to orders table';
    END IF;

    -- Add shopify_fulfillment_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shopify_fulfillment_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN shopify_fulfillment_id VARCHAR(255);
        RAISE NOTICE 'Added shopify_fulfillment_id column to orders table';
    END IF;

    -- Add shopify_fulfilled_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shopify_fulfilled_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN shopify_fulfilled_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added shopify_fulfilled_at column to orders table';
    END IF;

    -- Add sync_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'sync_status'
    ) THEN
        ALTER TABLE orders ADD COLUMN sync_status VARCHAR(50) DEFAULT 'pending';
        RAISE NOTICE 'Added sync_status column to orders table';
    END IF;

    -- Add sync_error column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'sync_error'
    ) THEN
        ALTER TABLE orders ADD COLUMN sync_error TEXT;
        RAISE NOTICE 'Added sync_error column to orders table';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_shopify_order_id ON orders(shopify_order_id) WHERE shopify_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_shopify_connection_id ON orders(shopify_connection_id) WHERE shopify_connection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_external_order_source ON orders(external_order_id, source) WHERE external_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);

-- Update existing Shopify orders to have proper relationships
UPDATE orders 
SET shopify_order_id = external_order_id 
WHERE source = 'shopify' 
AND external_order_id IS NOT NULL 
AND shopify_order_id IS NULL;

-- Link orders to shopify_connections where possible
UPDATE orders 
SET shopify_connection_id = (
    SELECT sc.id 
    FROM shopify_connections sc 
    WHERE sc.is_active = true 
    LIMIT 1
)
WHERE source = 'shopify' 
AND shopify_connection_id IS NULL 
AND EXISTS (SELECT 1 FROM shopify_connections WHERE is_active = true);

-- Add constraint for sync_status values
ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_sync_status_values;
ALTER TABLE orders ADD CONSTRAINT check_sync_status_values 
CHECK (sync_status IN ('pending', 'synced', 'failed', 'skipped'));

-- Create a function to automatically update sync status
CREATE OR REPLACE FUNCTION update_order_sync_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If order is delivered and has Shopify data, mark as pending sync
    IF NEW.status = 'delivered' AND NEW.source = 'shopify' AND NEW.shopify_order_id IS NOT NULL THEN
        IF NEW.shopify_fulfillment_id IS NULL THEN
            NEW.sync_status = 'pending';
        ELSE
            NEW.sync_status = 'synced';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic sync status updates
DROP TRIGGER IF EXISTS trigger_update_order_sync_status ON orders;
CREATE TRIGGER trigger_update_order_sync_status
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_order_sync_status();

-- Grant necessary permissions
GRANT SELECT, UPDATE ON orders TO service_role;
GRANT SELECT ON shopify_connections TO service_role;
GRANT SELECT ON shopify_orders TO service_role;

RAISE NOTICE 'Orders-Shopify relationship setup completed successfully!';
