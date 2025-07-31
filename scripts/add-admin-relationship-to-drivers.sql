-- Add admin relationship to user_profiles table for drivers
-- This script adds columns to track which admin manages each driver

-- Add created_by column to user_profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'created_by') THEN
        ALTER TABLE user_profiles ADD COLUMN created_by UUID REFERENCES auth.users(id);
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_user_profiles_created_by ON user_profiles(created_by);
        
        RAISE NOTICE 'Added created_by column to user_profiles table';
    ELSE
        RAISE NOTICE 'created_by column already exists in user_profiles table';
    END IF;
END $$;

-- Add admin_id column as an alternative approach
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'admin_id') THEN
        ALTER TABLE user_profiles ADD COLUMN admin_id UUID REFERENCES user_profiles(user_id);
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_user_profiles_admin_id ON user_profiles(admin_id);
        
        RAISE NOTICE 'Added admin_id column to user_profiles table';
    ELSE
        RAISE NOTICE 'admin_id column already exists in user_profiles table';
    END IF;
END $$;

-- Add availability_status column for driver status tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'availability_status') THEN
        ALTER TABLE user_profiles ADD COLUMN availability_status VARCHAR(20) DEFAULT 'inactive';
        
        -- Add check constraint for valid status values
        ALTER TABLE user_profiles ADD CONSTRAINT check_availability_status 
        CHECK (availability_status IN ('active', 'inactive', 'break', 'route_completed'));
        
        RAISE NOTICE 'Added availability_status column to user_profiles table';
    ELSE
        RAISE NOTICE 'availability_status column already exists in user_profiles table';
    END IF;
END $$;

-- Add current_location column for driver location tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'current_location') THEN
        ALTER TABLE user_profiles ADD COLUMN current_location JSONB;
        
        RAISE NOTICE 'Added current_location column to user_profiles table';
    ELSE
        RAISE NOTICE 'current_location column already exists in user_profiles table';
    END IF;
END $$;

-- Add current_route column for route tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'current_route') THEN
        ALTER TABLE user_profiles ADD COLUMN current_route VARCHAR(100);
        
        RAISE NOTICE 'Added current_route column to user_profiles table';
    ELSE
        RAISE NOTICE 'current_route column already exists in user_profiles table';
    END IF;
END $$;

-- Add estimated_completion_time column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'estimated_completion_time') THEN
        ALTER TABLE user_profiles ADD COLUMN estimated_completion_time VARCHAR(50);
        
        RAISE NOTICE 'Added estimated_completion_time column to user_profiles table';
    ELSE
        RAISE NOTICE 'estimated_completion_time column already exists in user_profiles table';
    END IF;
END $$;

-- Create RLS policies for admin-scoped access to drivers
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for admins to view their drivers
CREATE POLICY "Admins can view their drivers" ON user_profiles
    FOR SELECT USING (
        auth.uid() = user_id OR
        auth.uid() = created_by OR 
        auth.uid() = admin_id OR
        auth.uid() IN (
            SELECT user_id FROM user_profiles 
            WHERE role = 'admin' AND (user_id = created_by OR user_id = admin_id)
        ) OR
        auth.uid() IN (
            SELECT user_id FROM user_profiles WHERE role = 'super_admin'
        )
    );

-- Policy for admins to insert driver profiles
CREATE POLICY "Admins can create driver profiles" ON user_profiles
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM user_profiles WHERE role IN ('admin', 'super_admin')
        )
    );

-- Policy for admins to update their drivers
CREATE POLICY "Admins can update their drivers" ON user_profiles
    FOR UPDATE USING (
        auth.uid() = user_id OR
        auth.uid() = created_by OR 
        auth.uid() = admin_id OR
        auth.uid() IN (
            SELECT user_id FROM user_profiles 
            WHERE role = 'admin' AND (user_id = created_by OR user_id = admin_id)
        ) OR
        auth.uid() IN (
            SELECT user_id FROM user_profiles WHERE role = 'super_admin'
        )
    );

-- Function to automatically set created_by when creating driver profiles
CREATE OR REPLACE FUNCTION set_created_by_for_drivers()
RETURNS TRIGGER AS $$
BEGIN
    -- Set created_by to the current user if it's not already set
    IF NEW.created_by IS NULL AND NEW.role = 'driver' THEN
        NEW.created_by := auth.uid();
    END IF;
    
    -- Set admin_id to the current user if it's an admin creating a driver
    IF NEW.admin_id IS NULL AND NEW.role = 'driver' THEN
        IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin') THEN
            NEW.admin_id := auth.uid();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set relationships
DROP TRIGGER IF EXISTS trigger_set_created_by_for_drivers ON user_profiles;
CREATE TRIGGER trigger_set_created_by_for_drivers
    BEFORE INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_created_by_for_drivers();
