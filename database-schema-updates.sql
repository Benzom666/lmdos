-- Add columns to orders table for bulk delivery support
ALTER TABLE orders ADD COLUMN IF NOT EXISTS batch_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_batch_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_location VARCHAR(500);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_weight DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_dimensions VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS special_handling_instructions TEXT;

-- Add columns to order_updates table for enhanced POD
ALTER TABLE order_updates ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500);
ALTER TABLE order_updates ADD COLUMN IF NOT EXISTS delivered_to VARCHAR(255);
ALTER TABLE order_updates ADD COLUMN IF NOT EXISTS delivery_time TIMESTAMP;
ALTER TABLE order_updates ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(10,2);

-- Create delivery_batches table for managing bulk pickups
CREATE TABLE IF NOT EXISTS delivery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    driver_id UUID REFERENCES auth.users(id),
    warehouse_location VARCHAR(500) NOT NULL,
    pickup_time TIMESTAMP,
    total_packages INTEGER DEFAULT 0,
    completed_packages INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create delivery_routes table for route optimization
CREATE TABLE IF NOT EXISTS delivery_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES auth.users(id),
    batch_id UUID REFERENCES delivery_batches(id),
    route_data JSONB,
    total_distance DECIMAL(10,2),
    estimated_time INTEGER,
    actual_time INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create driver_locations table for real-time tracking
CREATE TABLE IF NOT EXISTS driver_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES auth.users(id),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy DECIMAL(10,2),
    speed DECIMAL(10,2),
    heading DECIMAL(10,2),
    timestamp TIMESTAMP DEFAULT NOW(),
    order_id UUID REFERENCES orders(id),
    activity_type VARCHAR(50) -- 'pickup', 'delivery', 'transit', 'idle'
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON orders(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_driver ON delivery_batches(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_time ON driver_locations(driver_id, timestamp);

-- Add comments for documentation
COMMENT ON TABLE delivery_batches IS 'Manages bulk pickup batches from warehouses';
COMMENT ON TABLE delivery_routes IS 'Stores optimized delivery routes for drivers';
COMMENT ON TABLE driver_locations IS 'Real-time location tracking for drivers';
