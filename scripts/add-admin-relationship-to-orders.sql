-- Add admin relationship to orders table
-- This script adds columns to track which admin created each order

-- Add created_by column to orders table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'created_by') THEN
        ALTER TABLE orders ADD COLUMN created_by UUID REFERENCES auth.users(id);
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
        
        -- Update existing orders to set created_by based on existing data
        -- This is a one-time migration - you may need to adjust this logic
        -- based on your specific requirements
        UPDATE orders 
        SET created_by = (
            SELECT user_id 
            FROM user_profiles 
            WHERE role = 'admin' 
            LIMIT 1
        )
        WHERE created_by IS NULL;
        
        RAISE NOTICE 'Added created_by column to orders table';
    ELSE
        RAISE NOTICE 'created_by column already exists in orders table';
    END IF;
END $$;

-- Add admin_id column as an alternative approach
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'admin_id') THEN
        ALTER TABLE orders ADD COLUMN admin_id UUID REFERENCES user_profiles(user_id);
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_orders_admin_id ON orders(admin_id);
        
        -- Update existing orders to set admin_id
        UPDATE orders 
        SET admin_id = (
            SELECT user_id 
            FROM user_profiles 
            WHERE role = 'admin' 
            LIMIT 1
        )
        WHERE admin_id IS NULL;
        
        RAISE NOTICE 'Added admin_id column to orders table';
    ELSE
        RAISE NOTICE 'admin_id column already exists in orders table';
    END IF;
END $$;

-- Create RLS policies for admin-scoped access
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy for admins to see only their orders
CREATE POLICY "Admins can view their own orders" ON orders
    FOR SELECT USING (
        auth.uid() = created_by OR 
        auth.uid() = admin_id OR
        auth.uid() IN (
            SELECT user_id FROM user_profiles 
            WHERE role = 'admin' AND (user_id = created_by OR user_id = admin_id)
        )
    );

-- Policy for admins to insert orders
CREATE POLICY "Admins can insert orders" ON orders
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM user_profiles WHERE role IN ('admin', 'super_admin')
        )
    );

-- Policy for admins to update their orders
CREATE POLICY "Admins can update their own orders" ON orders
    FOR UPDATE USING (
        auth.uid() = created_by OR 
        auth.uid() = admin_id OR
        auth.uid() IN (
            SELECT user_id FROM user_profiles 
            WHERE role = 'admin' AND (user_id = created_by OR user_id = admin_id)
        )
    );

-- Policy for drivers to view assigned orders
CREATE POLICY "Drivers can view assigned orders" ON orders
    FOR SELECT USING (
        auth.uid() = driver_id OR
        auth.uid() IN (
            SELECT user_id FROM user_profiles WHERE role = 'driver' AND user_id = driver_id
        )
    );

-- Policy for drivers to update assigned orders
CREATE POLICY "Drivers can update assigned orders" ON orders
    FOR UPDATE USING (
        auth.uid() = driver_id OR
        auth.uid() IN (
            SELECT user_id FROM user_profiles WHERE role = 'driver' AND user_id = driver_id
        )
    );
