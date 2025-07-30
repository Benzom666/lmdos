-- This script identifies and removes mock Shopify orders from the database
-- It looks for patterns in the data that indicate mock orders

-- First, let's identify the mock orders
WITH mock_orders AS (
  SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.customer_phone,
    o.customer_email,
    o.delivery_address
  FROM 
    orders o
  WHERE 
    -- Look for patterns in mock data
    (o.customer_email LIKE 'customer_@example.com' OR 
     o.customer_email LIKE 'customer%@example.com') OR
    (o.customer_phone LIKE '+1-555-%') OR
    (o.delivery_address LIKE '%Main St%NY%United States%') OR
    (o.order_number LIKE 'SH-10%')
)
SELECT * FROM mock_orders;

-- Count how many mock orders we found
SELECT COUNT(*) AS mock_order_count FROM mock_orders;

-- Now let's look at the shopify_orders table for mock data
WITH mock_shopify_orders AS (
  SELECT 
    so.id,
    so.order_number,
    so.customer_name,
    so.customer_email,
    so.customer_phone
  FROM 
    shopify_orders so
  WHERE 
    -- Look for patterns in mock data
    (so.customer_email LIKE 'customer_@example.com' OR 
     so.customer_email LIKE 'customer%@example.com') OR
    (so.customer_phone LIKE '+1-555-%')
)
SELECT * FROM mock_shopify_orders;

-- Count how many mock Shopify orders we found
SELECT COUNT(*) AS mock_shopify_order_count FROM mock_shopify_orders;

-- IMPORTANT: Review the results above before uncommenting and running the DELETE statements below
-- Make sure you're only deleting mock data!

/*
-- Delete mock orders
DELETE FROM orders
WHERE 
  (customer_email LIKE 'customer_@example.com' OR 
   customer_email LIKE 'customer%@example.com') OR
  (customer_phone LIKE '+1-555-%') OR
  (delivery_address LIKE '%Main St%NY%United States%') OR
  (order_number LIKE 'SH-10%');

-- Delete mock shopify_orders
DELETE FROM shopify_orders
WHERE 
  (customer_email LIKE 'customer_@example.com' OR 
   customer_email LIKE 'customer%@example.com') OR
  (customer_phone LIKE '+1-555-%');
*/
