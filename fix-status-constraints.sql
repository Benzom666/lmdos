-- Update the orders table status constraint to include all valid statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the correct status constraint
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'));

-- Update any existing invalid statuses
UPDATE orders SET status = 'pending' WHERE status NOT IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');

-- Verify the constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'orders_status_check';
