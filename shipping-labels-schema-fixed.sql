-- Drop existing table if it exists to recreate with proper relationships
DROP TABLE IF EXISTS shipping_labels CASCADE;

-- Create shipping_labels table with proper foreign key relationship
CREATE TABLE shipping_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  label_config JSONB NOT NULL,
  qr_data TEXT NOT NULL,
  
  -- Label metadata
  label_size VARCHAR(50) DEFAULT 'standard',
  theme VARCHAR(50) DEFAULT 'standard',
  status VARCHAR(50) DEFAULT 'generated',
  
  -- Tracking
  printed_at TIMESTAMP WITH TIME ZONE,
  print_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key constraints
  CONSTRAINT fk_shipping_labels_order_id 
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_shipping_labels_created_by 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Check constraints
  CONSTRAINT valid_status CHECK (status IN ('generated', 'printed', 'shipped', 'delivered')),
  CONSTRAINT valid_theme CHECK (theme IN ('minimal', 'standard', 'branded')),
  CONSTRAINT valid_label_size CHECK (label_size IN ('small', 'standard', 'large'))
);

-- Create indexes for performance
CREATE INDEX idx_shipping_labels_order_id ON shipping_labels(order_id);
CREATE INDEX idx_shipping_labels_created_by ON shipping_labels(created_by);
CREATE INDEX idx_shipping_labels_status ON shipping_labels(status);
CREATE INDEX idx_shipping_labels_created_at ON shipping_labels(created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_shipping_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shipping_labels_updated_at
  BEFORE UPDATE ON shipping_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_labels_updated_at();

-- Enable RLS
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view shipping labels for their orders" ON shipping_labels
  FOR SELECT USING (
    created_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = shipping_labels.order_id 
      AND orders.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create shipping labels for their orders" ON shipping_labels
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_id 
      AND orders.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their shipping labels" ON shipping_labels
  FOR UPDATE USING (
    created_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = shipping_labels.order_id 
      AND orders.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete their shipping labels" ON shipping_labels
  FOR DELETE USING (
    created_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = shipping_labels.order_id 
      AND orders.created_by = auth.uid()
    )
  );

-- Insert some sample data for testing (optional)
-- This will only work if you have existing orders
INSERT INTO shipping_labels (order_id, label_config, qr_data, created_by)
SELECT 
  o.id,
  '{"size": "standard", "theme": "standard", "includeBarcode": true}'::jsonb,
  'ORDER-' || o.order_number || '-' || o.id,
  o.created_by
FROM orders o
WHERE o.status IN ('pending', 'assigned', 'picked_up')
LIMIT 5
ON CONFLICT DO NOTHING;
