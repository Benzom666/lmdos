-- Create a queue table for tracking synchronization tasks
CREATE TABLE IF NOT EXISTS shopify_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shopify_connection_id UUID NOT NULL REFERENCES shopify_connections(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('fulfillment', 'cancellation', 'update')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    payload JSONB,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for the sync queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON shopify_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_scheduled_at ON shopify_sync_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_order_id ON shopify_sync_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_connection_id ON shopify_sync_queue(shopify_connection_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for sync queue
DROP TRIGGER IF EXISTS update_sync_queue_updated_at ON shopify_sync_queue;
CREATE TRIGGER update_sync_queue_updated_at
    BEFORE UPDATE ON shopify_sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

PRINT 'Shopify sync queue created successfully';
