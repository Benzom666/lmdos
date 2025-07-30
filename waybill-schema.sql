-- Create waybills table
CREATE TABLE IF NOT EXISTS waybills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  waybill_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Sender information
  sender_name VARCHAR(255) NOT NULL,
  sender_address TEXT NOT NULL,
  sender_phone VARCHAR(50) NOT NULL,
  
  -- Receiver information
  receiver_name VARCHAR(255) NOT NULL,
  receiver_address TEXT NOT NULL,
  receiver_phone VARCHAR(50) NOT NULL,
  
  -- Package information
  package_description TEXT NOT NULL,
  weight VARCHAR(50),
  dimensions VARCHAR(100),
  service_type VARCHAR(50) DEFAULT 'standard',
  declared_value VARCHAR(50),
  special_instructions TEXT,
  
  -- Tracking and status
  status VARCHAR(50) DEFAULT 'generated',
  tracking_updates JSONB DEFAULT '[]',
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_service_type CHECK (service_type IN ('standard', 'express', 'overnight', 'same-day')),
  CONSTRAINT valid_status CHECK (status IN ('generated', 'printed', 'dispatched', 'in_transit', 'delivered', 'returned'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_waybills_waybill_number ON waybills(waybill_number);
CREATE INDEX IF NOT EXISTS idx_waybills_order_id ON waybills(order_id);
CREATE INDEX IF NOT EXISTS idx_waybills_created_by ON waybills(created_by);
CREATE INDEX IF NOT EXISTS idx_waybills_status ON waybills(status);
CREATE INDEX IF NOT EXISTS idx_waybills_created_at ON waybills(created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_waybills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_waybills_updated_at
  BEFORE UPDATE ON waybills
  FOR EACH ROW
  EXECUTE FUNCTION update_waybills_updated_at();

-- Enable RLS
ALTER TABLE waybills ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own waybills" ON waybills
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create waybills" ON waybills
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own waybills" ON waybills
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own waybills" ON waybills
  FOR DELETE USING (created_by = auth.uid());
