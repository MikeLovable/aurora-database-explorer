
import { Customer, Product, Order } from '@/types';

// Mock data for local development and testing

// Generate 20 sample customers
export const mockCustomers: Customer[] = Array(20).fill(null).map((_, index) => {
  const id = (index + 1).toString().padStart(5, '0');
  return {
    CustomerID: id,
    Name: `Customer ${id}`,
    Email: `customer${id}@example.com`,
    Phone: `+1-555-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
    Address: `${Math.floor(100 + Math.random() * 9900)} Main St, City ${Math.floor(Math.random() * 100)}`
  };
});

// Generate 30 sample products
export const mockProducts: Product[] = Array(30).fill(null).map((_, index) => {
  const id = (index + 1).toString().padStart(5, '0');
  const categories = ['Electronics', 'Books', 'Clothing', 'Home', 'Food', 'Health'];
  return {
    ProductID: id,
    Name: `Product ${id}`,
    Description: `This is a description for product ${id}`,
    Price: parseFloat((10 + Math.random() * 990).toFixed(2)),
    Category: categories[Math.floor(Math.random() * categories.length)]
  };
});

// Generate 50 sample orders
export const mockOrders: Order[] = Array(50).fill(null).map((_, index) => {
  const id = (index + 1).toString().padStart(7, '0');
  const customerId = mockCustomers[Math.floor(Math.random() * mockCustomers.length)].CustomerID;
  const productId = mockProducts[Math.floor(Math.random() * mockProducts.length)].ProductID;
  const customer = mockCustomers.find(c => c.CustomerID === customerId);
  const product = mockProducts.find(p => p.ProductID === productId);
  
  // Generate a random date within the last year
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const orderDate = new Date(
    oneYearAgo.getTime() + Math.random() * (today.getTime() - oneYearAgo.getTime())
  );
  
  return {
    OrderID: id,
    CustomerID: customerId,
    ProductID: productId,
    Quantity: Math.floor(1 + Math.random() * 10),
    OrderDate: orderDate.toISOString().split('T')[0],
    CustomerName: customer?.Name,
    ProductName: product?.Name
  };
});

// Function to filter customers by ID
export const getCustomerById = (id?: string): Customer[] => {
  if (!id) return mockCustomers;
  return mockCustomers.filter(customer => customer.CustomerID === id);
};

// Function to filter products by ID
export const getProductById = (id?: string): Product[] => {
  if (!id) return mockProducts;
  return mockProducts.filter(product => product.ProductID === id);
};

// Function to filter orders by customer ID and/or product ID
export const getOrdersByFilters = (customerId?: string, productId?: string): Order[] => {
  return mockOrders.filter(order => {
    const matchCustomer = !customerId || order.CustomerID === customerId;
    const matchProduct = !productId || order.ProductID === productId;
    return matchCustomer && matchProduct;
  });
};

// Function to create a new order
export const transactOrder = (customerId: string, productId: string): TransactionResult => {
  const customer = mockCustomers.find(c => c.CustomerID === customerId);
  const product = mockProducts.find(p => p.ProductID === productId);
  
  if (!customer) {
    return { success: false, message: `Customer with ID ${customerId} not found` };
  }
  
  if (!product) {
    return { success: false, message: `Product with ID ${productId} not found` };
  }
  
  // Create a new order
  const newOrderId = (mockOrders.length + 1).toString().padStart(7, '0');
  const newOrder: Order = {
    OrderID: newOrderId,
    CustomerID: customerId,
    ProductID: productId,
    Quantity: 1, // Default quantity
    OrderDate: new Date().toISOString().split('T')[0],
    CustomerName: customer.Name,
    ProductName: product.Name
  };
  
  // In a real app, we would save the order to a database
  // For this mock implementation, we'll just add it to our in-memory array
  mockOrders.push(newOrder);
  
  return {
    success: true,
    message: `Order ${newOrderId} created successfully`,
    orderId: newOrderId
  };
};

type TransactionResult = {
  success: boolean;
  message: string;
  orderId?: string;
};
