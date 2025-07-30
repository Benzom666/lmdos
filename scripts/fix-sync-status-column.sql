-- Add sync_status and sync_error columns to orders table if they don't exist
DO $$ 
BEGIN
    -- Add sync_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'sync_status') THEN
        ALTER TABLE orders ADD COLUMN sync_status TEXT DEFAULT 'pending';
        CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);
    END IF;
    
    -- Add sync_error column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'sync_error') THEN
        ALTER TABLE orders ADD COLUMN sync_error TEXT;
    END IF;
    
    -- Update existing delivered orders to have pending sync status
    UPDATE orders 
    SET sync_status = 'pending' 
    WHERE status = 'delivered' 
    AND shopify_order_id IS NOT NULL 
    AND sync_status IS NULL;
    
    RAISE NOTICE 'Sync status columns added and updated successfully';
END $$;
