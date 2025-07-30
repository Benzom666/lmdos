-- Create scan logs table for tracking scan attempts and validation
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES auth.users(id),
  order_id UUID,
  scan_data TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT false,
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_scan_logs_driver_id ON scan_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_order_id ON scan_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON scan_logs(scanned_at);

-- Enable RLS
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Drivers can view their own scan logs" ON scan_logs
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own scan logs" ON scan_logs
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Admins can view all scan logs
CREATE POLICY "Admins can view all scan logs" ON scan_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );
