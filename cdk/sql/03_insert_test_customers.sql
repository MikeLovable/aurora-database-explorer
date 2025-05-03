
-- Insert test customers
INSERT INTO customers (customer_id, name, email, phone, address)
VALUES
  ('C0001', 'John Smith', 'john.smith@example.com', '555-123-4567', '123 Main St, Anytown, USA'),
  ('C0002', 'Jane Doe', 'jane.doe@example.com', '555-234-5678', '456 Oak Ave, Somecity, USA'),
  ('C0003', 'Robert Johnson', 'robert.johnson@example.com', '555-345-6789', '789 Pine Rd, Otherville, USA'),
  ('C0004', 'Emily Williams', 'emily.williams@example.com', '555-456-7890', '321 Elm St, Newtown, USA'),
  ('C0005', 'Michael Brown', 'michael.brown@example.com', '555-567-8901', '654 Maple Dr, Oldcity, USA'),
  ('C0006', 'Sarah Miller', 'sarah.miller@example.com', '555-678-9012', '987 Cedar Ln, Westville, USA'),
  ('C0007', 'David Wilson', 'david.wilson@example.com', '555-789-0123', '159 Birch Blvd, Eastburg, USA'),
  ('C0008', 'Jennifer Taylor', 'jennifer.taylor@example.com', '555-890-1234', '753 Spruce Ct, Northport, USA'),
  ('C0009', 'Daniel Martinez', 'daniel.martinez@example.com', '555-901-2345', '264 Willow Way, Southville, USA'),
  ('C0010', 'Lisa Anderson', 'lisa.anderson@example.com', '555-012-3456', '825 Ash St, Centertown, USA'),
  ('C0011', 'James Thomas', 'james.thomas@example.com', '555-543-2109', '468 Walnut Ave, Riverside, USA'),
  ('C0012', 'Patricia Jackson', 'patricia.jackson@example.com', '555-432-1098', '975 Cherry St, Lakeside, USA'),
  ('C0013', 'Richard White', 'richard.white@example.com', '555-321-0987', '246 Pineapple Rd, Beachtown, USA'),
  ('C0014', 'Elizabeth Harris', 'elizabeth.harris@example.com', '555-210-9876', '813 Coconut Dr, Mountainview, USA'),
  ('C0015', 'Charles Clark', 'charles.clark@example.com', '555-109-8765', '579 Apple Ln, Valleyville, USA'),
  ('C0016', 'Susan Lewis', 'susan.lewis@example.com', '555-098-7654', '315 Orange Blvd, Hilltop, USA'),
  ('C0017', 'Joseph Walker', 'joseph.walker@example.com', '555-987-6543', '642 Grape Ct, Plainsville, USA'),
  ('C0018', 'Mary Young', 'mary.young@example.com', '555-876-5432', '159 Lemon Way, Forestville, USA'),
  ('C0019', 'Thomas Allen', 'thomas.allen@example.com', '555-765-4321', '753 Peach St, Deserttown, USA'),
  ('C0020', 'Margaret King', 'margaret.king@example.com', '555-654-3210', '246 Banana Ave, Fieldsville, USA')
ON CONFLICT (customer_id) DO NOTHING;
