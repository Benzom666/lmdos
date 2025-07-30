-- Create driver_routes table for persistent route management
CREATE TABLE IF NOT EXISTS driver_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  total_distance DECIMAL(10,2) DEFAULT 0,
  total_time INTEGER DEFAULT 0, -- in minutes
  completed_distance DECIMAL(10,2) DEFAULT 0,
  completed_time INTEGER DEFAULT 0, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(driver_id, shift_date, status) -- Only one active route per driver per day
);

-- Create route_stops table for individual delivery stops
CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES driver_routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  estimated_time INTEGER NOT NULL, -- in minutes
  estimated_distance DECIMAL(10,2) NOT NULL,
  actual_time INTEGER,
  actual_distance DECIMAL(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, order_id)
);

-- Create route_history table for tracking route changes
CREATE TABLE IF NOT EXISTS route_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES driver_routes(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'cancelled', 'recalculated')),
  description TEXT NOT NULL,
  stop_count INTEGER DEFAULT 0,
  total_distance DECIMAL(10,2) DEFAULT 0,
  total_time INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_driver_routes_driver_date ON driver_routes(driver_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_driver_routes_status ON driver_routes(status);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence ON route_stops(route_id, sequence);
CREATE INDEX IF NOT EXISTS idx_route_stops_status ON route_stops(status);
CREATE INDEX IF NOT EXISTS idx_route_history_route_id ON route_history(route_id);
CREATE INDEX IF NOT EXISTS idx_route_history_timestamp ON route_history(timestamp);

-- Enable RLS
ALTER TABLE driver_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for driver_routes
CREATE POLICY "Drivers can view their own routes" ON driver_routes
  FOR SELECT USING (driver_id = auth.uid());

CREATE POLICY "Drivers can create their own routes" ON driver_routes
  FOR INSERT WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can update their own routes" ON driver_routes
  FOR UPDATE USING (driver_id = auth.uid());

-- RLS Policies for route_stops
CREATE POLICY "Drivers can view stops for their routes" ON route_stops
  FOR SELECT USING (
    route_id IN (
      SELECT id FROM driver_routes WHERE driver_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can create stops for their routes" ON route_stops
  FOR INSERT WITH CHECK (
    route_id IN (
      SELECT id FROM driver_routes WHERE driver_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update stops for their routes" ON route_stops
  FOR UPDATE USING (
    route_id IN (
      SELECT id FROM driver_routes WHERE driver_id = auth.uid()
    )
  );

-- RLS Policies for route_history
CREATE POLICY "Drivers can view history for their routes" ON route_history
  FOR SELECT USING (
    route_id IN (
      SELECT id FROM driver_routes WHERE driver_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can create history for their routes" ON route_history
  FOR INSERT WITH CHECK (
    route_id IN (
      SELECT id FROM driver_routes WHERE driver_id = auth.uid()
    )
  );

-- Admins can view all route data
CREATE POLICY "Admins can view all routes" ON driver_routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can view all route stops" ON route_stops
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can view all route history" ON route_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_driver_routes_updated_at 
  BEFORE UPDATE ON driver_routes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_route_stops_updated_at 
  BEFORE UPDATE ON route_stops 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
