-- Fix Shopify order status constraints to handle all possible Shopify values

-- Drop existing constraints if they exist
ALTER TABLE shopify_orders DROP CONSTRAINT IF EXISTS valid_fulfillment_status;
ALTER TABLE shopify_orders DROP CONSTRAINT IF EXISTS valid_financial_status;

-- Add comprehensive constraint for fulfillment_status that includes all possible Shopify values
ALTER TABLE shopify_orders ADD CONSTRAINT valid_fulfillment_status 
CHECK (fulfillment_status IN (
  'fulfilled',      -- Order is completely fulfilled
  'unfulfilled',    -- Order is not fulfilled (default)
  'partial',        -- Order is partially fulfilled
  'restocked',      -- Order items have been restocked
  'pending',        -- Fulfillment is pending
  'open',           -- Order is open for fulfillment
  'cancelled',      -- Order fulfillment was cancelled
  'null'            -- Explicitly handle null as string
));

-- Add comprehensive constraint for financial_status
ALTER TABLE shopify_orders ADD CONSTRAINT valid_financial_status 
CHECK (financial_status IN (
  'pending',            -- Payment is pending (default)
  'authorized',         -- Payment is authorized but not captured
  'partially_paid',     -- Order is partially paid
  'paid',              -- Order is fully paid
  'partially_refunded', -- Order is partially refunded
  'refunded',          -- Order is fully refunded
  'voided',            -- Payment authorization was voided
  'cancelled'          -- Payment was cancelled
));

-- Update any existing records that might have invalid statuses
UPDATE shopify_orders 
SET fulfillment_status = 'unfulfilled' 
WHERE fulfillment_status NOT IN ('fulfilled', 'unfulfilled', 'partial', 'restocked', 'pending', 'open', 'cancelled', 'null');

UPDATE shopify_orders 
SET financial_status = 'pending' 
WHERE financial_status NOT IN ('pending', 'authorized', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'voided', 'cancelled');

-- Add indexes for better query performance on status fields
CREATE INDEX IF NOT EXISTS idx_shopify_orders_fulfillment_status ON shopify_orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_financial_status ON shopify_orders(financial_status);
