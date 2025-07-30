-- Create shipping_labels table
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
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
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('generated', 'printed', 'shipped', 'delivered')),
  CONSTRAINT valid_theme CHECK (theme IN ('minimal', 'standard', 'branded'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_id ON shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_by ON shipping_labels(created_by);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON shipping_labels(status);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_at ON shipping_labels(created_at);

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
CREATE POLICY "Users can view their own shipping labels" ON shipping_labels
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create shipping labels" ON shipping_labels
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own shipping labels" ON shipping_labels
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own shipping labels" ON shipping_labels
  FOR DELETE USING (created_by = auth.uid());
