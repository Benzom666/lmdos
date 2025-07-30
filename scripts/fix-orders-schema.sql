-- Fix the missing completed_at column and add other necessary fields
DO $$ 
BEGIN
    -- Add completed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'completed_at') THEN
        ALTER TABLE orders ADD COLUMN completed_at TIMESTAMPTZ;
        PRINT 'Added completed_at column to orders table';
    END IF;

    -- Add shopify_fulfillment_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shopify_fulfillment_id') THEN
        ALTER TABLE orders ADD COLUMN shopify_fulfillment_id TEXT;
        PRINT 'Added shopify_fulfillment_id column to orders table';
    END IF;

    -- Add shopify_fulfilled_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shopify_fulfilled_at') THEN
        ALTER TABLE orders ADD COLUMN shopify_fulfilled_at TIMESTAMPTZ;
        PRINT 'Added shopify_fulfilled_at column to orders table';
    END IF;

    -- Add last_sync_attempt column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'last_sync_attempt') THEN
        ALTER TABLE orders ADD COLUMN last_sync_attempt TIMESTAMPTZ;
        PRINT 'Added last_sync_attempt column to orders table';
    END IF;

    -- Add sync_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'sync_status') THEN
        ALTER TABLE orders ADD COLUMN sync_status TEXT DEFAULT 'pending';
        PRINT 'Added sync_status column to orders table';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);

-- Update existing orders to set completed_at for delivered orders
UPDATE orders 
SET completed_at = updated_at 
WHERE status = 'delivered' AND completed_at IS NULL;

PRINT 'Orders schema updated successfully';
