-- Add new columns to order_updates table for enhanced POD
ALTER TABLE order_updates 
ADD COLUMN IF NOT EXISTS signature_data TEXT,
ADD COLUMN IF NOT EXISTS delivery_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS photo_count INTEGER DEFAULT 0;

-- Update existing photo_url column to support JSON array of photos
COMMENT ON COLUMN order_updates.photo_url IS 'JSON array of base64 encoded photos or single photo URL';

-- Create index for better performance on delivery queries
CREATE INDEX IF NOT EXISTS idx_order_updates_delivery_timestamp ON order_updates(delivery_timestamp);
CREATE INDEX IF NOT EXISTS idx_order_updates_driver_status ON order_updates(driver_id, status);

-- Add constraint to ensure minimum photo requirements
ALTER TABLE order_updates 
ADD CONSTRAINT chk_pod_requirements 
CHECK (
  (status != 'delivered') OR 
  (status = 'delivered' AND photo_url IS NOT NULL AND signature_data IS NOT NULL AND customer_name IS NOT NULL)
);

-- Create a view for comprehensive delivery reports
CREATE OR REPLACE VIEW delivery_reports AS
SELECT 
  o.id as order_id,
  o.order_number,
  o.customer_name as original_customer,
  o.delivery_address,
  o.status as current_status,
  ou.customer_name as received_by,
  ou.delivery_timestamp,
  ou.photo_url,
  ou.signature_data,
  ou.notes,
  ou.latitude,
  ou.longitude,
  up.first_name || ' ' || up.last_name as driver_name,
  up.email as driver_email
FROM orders o
LEFT JOIN order_updates ou ON o.id = ou.order_id AND ou.status = 'delivered'
LEFT JOIN user_profiles up ON ou.driver_id = up.user_id
WHERE o.status = 'delivered';

-- Grant appropriate permissions
GRANT SELECT ON delivery_reports TO authenticated;
