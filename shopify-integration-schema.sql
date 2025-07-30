-- Drop tables in reverse dependency order to avoid foreign key constraint issues
DROP TABLE IF EXISTS shopify_webhook_logs CASCADE;
DROP TABLE IF EXISTS shopify_orders CASCADE;
DROP TABLE IF EXISTS shopify_connections CASCADE;

-- Create Shopify connections table
CREATE TABLE IF NOT EXISTS shopify_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_domain VARCHAR(255) NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  webhook_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  orders_synced INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{
    "auto_create_orders": true,
    "auto_assign_drivers": false,
    "sync_order_status": true,
    "notification_emails": [],
    "fulfillment_service": false
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Shopify orders table for tracking synced orders
CREATE TABLE IF NOT EXISTS shopify_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_connection_id UUID NOT NULL REFERENCES shopify_connections(id) ON DELETE CASCADE,
  shopify_order_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(255),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  shipping_address JSONB,
  line_items JSONB,
  total_price DECIMAL(10,2),
  fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled',
  financial_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shopify_connection_id, shopify_order_id)
);

-- Drop the existing constraint if it exists
ALTER TABLE shopify_orders DROP CONSTRAINT IF EXISTS valid_fulfillment_status;

-- Add a more comprehensive constraint that includes all possible Shopify fulfillment statuses
ALTER TABLE shopify_orders ADD CONSTRAINT valid_fulfillment_status 
CHECK (fulfillment_status IN (
  'fulfilled', 
  'unfulfilled', 
  'partial', 
  'restocked',
  'pending',
  'open',
  'cancelled',
  'null'
));

-- Drop the existing constraint if it exists  
ALTER TABLE shopify_orders DROP CONSTRAINT IF EXISTS valid_financial_status;

-- Add constraint for financial_status
ALTER TABLE shopify_orders ADD CONSTRAINT valid_financial_status 
CHECK (financial_status IN (
  'pending',
  'authorized', 
  'partially_paid',
  'paid',
  'partially_refunded',
  'refunded',
  'voided',
  'cancelled'
));

-- Create Shopify webhook logs table for debugging
CREATE TABLE IF NOT EXISTS shopify_webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_connection_id UUID REFERENCES shopify_connections(id) ON DELETE CASCADE,
  topic VARCHAR(100) NOT NULL,
  shop_domain VARCHAR(255) NOT NULL,
  order_id VARCHAR(255),
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopify_connections_admin_id ON shopify_connections(admin_id);
CREATE INDEX IF NOT EXISTS idx_shopify_connections_shop_domain ON shopify_connections(shop_domain);
CREATE INDEX IF NOT EXISTS idx_shopify_connections_is_active ON shopify_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_connection_id ON shopify_orders(shopify_connection_id);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_shopify_order_id ON shopify_orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_order_number ON shopify_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_created_at ON shopify_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_shopify_webhook_logs_connection_id ON shopify_webhook_logs(shopify_connection_id);
CREATE INDEX IF NOT EXISTS idx_shopify_webhook_logs_created_at ON shopify_webhook_logs(created_at);

-- Add source and external_order_id columns to orders table if they don't exist
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(255);

-- Create index for external order lookups
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id, source);

-- Grant permissions to service_role for all Shopify tables
GRANT ALL ON shopify_connections TO service_role;
GRANT ALL ON shopify_orders TO service_role;
GRANT ALL ON shopify_webhook_logs TO service_role;

-- Enable Row Level Security
ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage their own Shopify connections" ON shopify_connections;
DROP POLICY IF EXISTS "Admins can manage their Shopify orders" ON shopify_orders;
DROP POLICY IF EXISTS "Admins can manage their Shopify webhook logs" ON shopify_webhook_logs;

-- Create RLS policies for Shopify connections
CREATE POLICY "Admins can manage their own Shopify connections" ON shopify_connections
  FOR ALL USING (
    admin_id IN (
      SELECT user_id FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  ) WITH CHECK (
    admin_id IN (
      SELECT user_id FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for Shopify orders - Allow both SELECT and INSERT for admins
CREATE POLICY "Admins can manage their Shopify orders" ON shopify_orders
  FOR ALL USING (
    shopify_connection_id IN (
      SELECT id FROM shopify_connections
      WHERE admin_id IN (
        SELECT user_id FROM user_profiles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  ) WITH CHECK (
    shopify_connection_id IN (
      SELECT id FROM shopify_connections
      WHERE admin_id IN (
        SELECT user_id FROM user_profiles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Create RLS policies for Shopify webhook logs
CREATE POLICY "Admins can manage their Shopify webhook logs" ON shopify_webhook_logs
  FOR ALL USING (
    shopify_connection_id IN (
      SELECT id FROM shopify_connections
      WHERE admin_id IN (
        SELECT user_id FROM user_profiles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  ) WITH CHECK (
    shopify_connection_id IN (
      SELECT id FROM shopify_connections
      WHERE admin_id IN (
        SELECT user_id FROM user_profiles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shopify_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_shopify_connections_updated_at ON shopify_connections;
DROP TRIGGER IF EXISTS update_shopify_orders_updated_at ON shopify_orders;

CREATE TRIGGER update_shopify_connections_updated_at
  BEFORE UPDATE ON shopify_connections
  FOR EACH ROW EXECUTE FUNCTION update_shopify_updated_at_column();

CREATE TRIGGER update_shopify_orders_updated_at
  BEFORE UPDATE ON shopify_orders
  FOR EACH ROW EXECUTE FUNCTION update_shopify_updated_at_column();

-- Create function to automatically sync order status back to Shopify
CREATE OR REPLACE FUNCTION sync_order_status_to_shopify()
RETURNS TRIGGER AS $$
DECLARE
  shopify_conn RECORD;
  shopify_order_num VARCHAR(255);
BEGIN
  -- Check if this is a Shopify-originated order
  IF NEW.source = 'shopify' AND NEW.external_order_id IS NOT NULL THEN
    -- Get the Shopify connection details
    SELECT sc.* INTO shopify_conn
    FROM shopify_connections sc
    JOIN shopify_orders so ON so.shopify_connection_id = sc.id AND so.shopify_order_id = NEW.external_order_id
    WHERE sc.is_active = true
    AND sc.settings->>'sync_order_status' = 'true'
    LIMIT 1;

    -- If we found a connection and the order status changed to delivered
    IF FOUND AND NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
      -- Log this for external processing (webhook or background job)
      INSERT INTO shopify_webhook_logs (
        shopify_connection_id,
        topic,
        shop_domain,
        order_id,
        payload,
        processed
      ) VALUES (
        shopify_conn.id,
        'fulfillment/create',
        shopify_conn.shop_domain,
        NEW.external_order_id,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'delivery_status', NEW.status,
          'completed_at', NEW.completed_at,
          'driver_id', NEW.driver_id
        ),
        false
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order status sync
DROP TRIGGER IF EXISTS sync_order_status_to_shopify_trigger ON orders;
CREATE TRIGGER sync_order_status_to_shopify_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_order_status_to_shopify();
