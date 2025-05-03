
-- Create Customers table
CREATE TABLE IF NOT EXISTS customers (
  customer_id VARCHAR(5) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20),
  address VARCHAR(255)
);

-- Create Products table
CREATE TABLE IF NOT EXISTS products (
  product_id VARCHAR(5) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  category VARCHAR(50)
);

-- Create Orders table
CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(8) PRIMARY KEY,
  customer_id VARCHAR(5) NOT NULL,
  product_id VARCHAR(5) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE
);
