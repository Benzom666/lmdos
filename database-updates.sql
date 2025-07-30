-- Add new columns to order_updates table for enhanced POD
ALTER TABLE order_updates 
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS delivered_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS delivery_time TIMESTAMP WITH TIME ZONE;

-- Add comments for new columns
COMMENT ON COLUMN order_updates.signature_url IS 'URL to stored customer signature image';
COMMENT ON COLUMN order_updates.delivered_to IS 'Name of person who received the package';
COMMENT ON COLUMN order_updates.delivery_time IS 'Actual delivery completion time';

-- Create storage bucket for delivery files if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-files', 'delivery-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for delivery files bucket
CREATE POLICY "Drivers can upload delivery files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'delivery-files' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Drivers can view their delivery files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'delivery-files' AND
  auth.role() = 'authenticated'
);

-- Create index for faster POD queries
CREATE INDEX IF NOT EXISTS idx_order_updates_pod 
ON order_updates(order_id, status) 
WHERE status = 'delivered';

-- Verify the updates
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'order_updates' 
AND column_name IN ('signature_url', 'delivered_to', 'delivery_time')
ORDER BY column_name;
