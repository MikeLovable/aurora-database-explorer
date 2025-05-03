
import { SecretsManager } from 'aws-sdk';
import { Client } from 'pg';
import * as AWS from 'aws-sdk';

/**
 * Environment variables used by the function
 */
const { DB_SECRET_ARN } = process.env;

/**
 * Secret manager client for retrieving database credentials
 */
const secretsManager = new SecretsManager();

/**
 * Handler for the API Gateway Lambda function
 */
export async function handler(event: any): Promise<any> {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Enable CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST',
    'Access-Control-Allow-Credentials': true,
  };
  
  try {
    // Get the action from the event
    const { action, customerId, productId } = event;
    
    if (!action) {
      return formatResponse(400, { success: false, message: 'Missing action parameter' }, headers);
    }
    
    // Get database credentials from Secrets Manager
    const secretData = await getSecret(DB_SECRET_ARN!);
    const { host, username, password, dbname } = secretData;
    
    // Handle the action
    switch (action) {
      case 'GetProducts':
        return formatResponse(
          200,
          await getProducts(host, dbname, username, password, productId),
          headers
        );
      
      case 'GetCustomers':
        return formatResponse(
          200,
          await getCustomers(host, dbname, username, password, customerId),
          headers
        );
      
      case 'GetOrders':
        return formatResponse(
          200,
          await getOrders(host, dbname, username, password, customerId, productId),
          headers
        );
      
      case 'TransactOrder':
        if (!customerId || !productId) {
          return formatResponse(
            400,
            { success: false, message: 'Missing required parameters: CustomerID and ProductID' },
            headers
          );
        }
        return formatResponse(
          200,
          await transactOrder(host, dbname, username, password, customerId, productId),
          headers
        );
      
      default:
        return formatResponse(
          400,
          { success: false, message: `Unsupported action: ${action}` },
          headers
        );
    }
  } catch (error) {
    console.error('Error:', error);
    return formatResponse(
      500,
      { success: false, message: `An error occurred: ${(error as Error).message}` },
      headers
    );
  }
}

/**
 * Formats an API response
 */
function formatResponse(statusCode: number, body: any, headers: any): any {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

/**
 * Retrieves a secret from AWS Secrets Manager
 */
async function getSecret(secretArn: string): Promise<any> {
  console.log(`Retrieving secret: ${secretArn}`);
  
  const response = await secretsManager.getSecretValue({
    SecretId: secretArn,
  }).promise();
  
  if (!response.SecretString) {
    throw new Error('Secret string is empty');
  }
  
  return JSON.parse(response.SecretString);
}

/**
 * Connects to a PostgreSQL database
 */
async function connectToDatabase(
  host: string,
  database: string,
  username: string,
  password: string
): Promise<Client> {
  console.log(`Connecting to database ${database} as ${username} at ${host}`);
  
  const client = new Client({
    host,
    port: 5432,
    database,
    user: username,
    password,
    ssl: {
      rejectUnauthorized: false, // Required for AWS RDS SSL
    },
    connectionTimeoutMillis: 10000,
  });
  
  await client.connect();
  console.log('Connected to database');
  
  return client;
}

/**
 * Retrieves products from the database
 */
async function getProducts(
  host: string,
  database: string,
  username: string,
  password: string,
  productId?: string
): Promise<any> {
  let client;
  
  try {
    client = await connectToDatabase(host, database, username, password);
    
    let query = 'SELECT * FROM products';
    const params: any[] = [];
    
    if (productId) {
      query += ' WHERE product_id = $1';
      params.push(productId);
    }
    
    query += ' LIMIT 100';
    
    console.log(`Executing query: ${query} with params: ${params}`);
    const result = await client.query(query, params);
    
    // Map database column names to camelCase for API
    const products = result.rows.map(row => ({
      ProductID: row.product_id,
      Name: row.name,
      Description: row.description,
      Price: parseFloat(row.price),
      Category: row.category,
    }));
    
    console.log(`Found ${products.length} products`);
    return { success: true, data: products };
  } finally {
    if (client) {
      await client.end();
      console.log('Database connection closed');
    }
  }
}

/**
 * Retrieves customers from the database
 */
async function getCustomers(
  host: string,
  database: string,
  username: string,
  password: string,
  customerId?: string
): Promise<any> {
  let client;
  
  try {
    client = await connectToDatabase(host, database, username, password);
    
    let query = 'SELECT * FROM customers';
    const params: any[] = [];
    
    if (customerId) {
      query += ' WHERE customer_id = $1';
      params.push(customerId);
    }
    
    query += ' LIMIT 100';
    
    console.log(`Executing query: ${query} with params: ${params}`);
    const result = await client.query(query, params);
    
    // Map database column names to camelCase for API
    const customers = result.rows.map(row => ({
      CustomerID: row.customer_id,
      Name: row.name,
      Email: row.email,
      Phone: row.phone,
      Address: row.address,
    }));
    
    console.log(`Found ${customers.length} customers`);
    return { success: true, data: customers };
  } finally {
    if (client) {
      await client.end();
      console.log('Database connection closed');
    }
  }
}

/**
 * Retrieves orders from the database
 */
async function getOrders(
  host: string,
  database: string,
  username: string,
  password: string,
  customerId?: string,
  productId?: string
): Promise<any> {
  let client;
  
  try {
    client = await connectToDatabase(host, database, username, password);
    
    // Create a join query to get additional information
    let query = `
      SELECT o.*, c.name as customer_name, p.name as product_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products p ON o.product_id = p.product_id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (customerId) {
      conditions.push(`o.customer_id = $${params.length + 1}`);
      params.push(customerId);
    }
    
    if (productId) {
      conditions.push(`o.product_id = $${params.length + 1}`);
      params.push(productId);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY o.order_date DESC LIMIT 100';
    
    console.log(`Executing query: ${query} with params: ${params}`);
    const result = await client.query(query, params);
    
    // Map database column names to camelCase for API
    const orders = result.rows.map(row => ({
      OrderID: row.order_id,
      CustomerID: row.customer_id,
      ProductID: row.product_id,
      Quantity: row.quantity,
      OrderDate: row.order_date.toISOString().split('T')[0],
      CustomerName: row.customer_name,
      ProductName: row.product_name,
    }));
    
    console.log(`Found ${orders.length} orders`);
    return { success: true, data: orders };
  } finally {
    if (client) {
      await client.end();
      console.log('Database connection closed');
    }
  }
}

/**
 * Creates a new order
 */
async function transactOrder(
  host: string,
  database: string,
  username: string,
  password: string,
  customerId: string,
  productId: string
): Promise<any> {
  let client;
  
  try {
    client = await connectToDatabase(host, database, username, password);
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Verify the customer exists
    const customerResult = await client.query(
      'SELECT customer_id FROM customers WHERE customer_id = $1',
      [customerId]
    );
    
    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Customer with ID ${customerId} not found`,
      };
    }
    
    // Verify the product exists
    const productResult = await client.query(
      'SELECT product_id FROM products WHERE product_id = $1',
      [productId]
    );
    
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Product with ID ${productId} not found`,
      };
    }
    
    // Generate a new order ID
    const orderIdResult = await client.query(
      'SELECT CONCAT(\'ORD\', LPAD(CAST(COALESCE(MAX(CAST(SUBSTRING(order_id, 4) AS INT)), 0) + 1 AS TEXT), 5, \'0\')) AS new_order_id FROM orders'
    );
    const orderId = orderIdResult.rows[0].new_order_id;
    
    // Insert the new order
    await client.query(
      `INSERT INTO orders (order_id, customer_id, product_id, quantity, order_date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
      [orderId, customerId, productId, 1]
    );
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`Order ${orderId} created successfully`);
    return {
      success: true,
      message: `Order ${orderId} created successfully`,
      orderId: orderId,
    };
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error creating order:', error);
    throw error;
  } finally {
    if (client) {
      await client.end();
      console.log('Database connection closed');
    }
  }
}
