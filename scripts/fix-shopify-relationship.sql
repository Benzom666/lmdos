-- Create a function to check if the shopify_connections table exists
CREATE OR REPLACE FUNCTION check_shopify_connections_table() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'shopify_connections'
    );
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if the orders table exists
CREATE OR REPLACE FUNCTION check_orders_table() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'orders'
    );
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if the shopify_connection_id column exists in orders table
CREATE OR REPLACE FUNCTION check_shopify_connection_id_column() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'shopify_connection_id'
    );
END;
$$ LANGUAGE plpgsql;

-- Add shopify_connection_id column to orders table if it doesn't exist
DO $$
BEGIN
    IF check_orders_table() AND NOT check_shopify_connection_id_column() THEN
        ALTER TABLE orders ADD COLUMN shopify_connection_id UUID;
        RAISE NOTICE 'Added shopify_connection_id column to orders table';
    END IF;
END $$;

-- Create index on shopify_connection_id for better performance
DO $$
BEGIN
    IF check_orders_table() AND check_shopify_connection_id_column() THEN
        CREATE INDEX IF NOT EXISTS idx_orders_shopify_connection_id ON orders(shopify_connection_id);
        RAISE NOTICE 'Created index on shopify_connection_id column';
    END IF;
END $$;

-- Create a function to count orders by shopify_connection_id
CREATE OR REPLACE FUNCTION count_orders_by_shopify_connection(connection_id UUID) RETURNS INTEGER AS $$
DECLARE
    order_count INTEGER;
BEGIN
    IF NOT check_orders_table() OR NOT check_shopify_connection_id_column() THEN
        RETURN 0;
    END IF;
    
    SELECT COUNT(*) INTO order_count
    FROM orders
    WHERE shopify_connection_id = connection_id;
    
    RETURN order_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update orders_synced in shopify_connections
CREATE OR REPLACE FUNCTION update_shopify_connection_orders_synced() RETURNS TRIGGER AS $$
BEGIN
    IF check_shopify_connections_table() AND NEW.shopify_connection_id IS NOT NULL THEN
        UPDATE shopify_connections
        SET orders_synced = count_orders_by_shopify_connection(NEW.shopify_connection_id)
        WHERE id = NEW.shopify_connection_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update orders_synced when a new order is added
DO $$
BEGIN
    IF check_orders_table() AND check_shopify_connections_table() AND check_shopify_connection_id_column() THEN
        DROP TRIGGER IF EXISTS update_shopify_orders_count ON orders;
        CREATE TRIGGER update_shopify_orders_count
        AFTER INSERT OR UPDATE OF shopify_connection_id ON orders
        FOR EACH ROW
        EXECUTE FUNCTION update_shopify_connection_orders_synced();
        
        RAISE NOTICE 'Created trigger to update orders_synced count';
    END IF;
END $$;

-- Update all shopify_connections with current order counts
DO $$
BEGIN
    IF check_shopify_connections_table() AND check_orders_table() AND check_shopify_connection_id_column() THEN
        UPDATE shopify_connections sc
        SET orders_synced = (
            SELECT COUNT(*) 
            FROM orders o 
            WHERE o.shopify_connection_id = sc.id
        );
        
        RAISE NOTICE 'Updated all shopify_connections with current order counts';
    END IF;
END $$;
