
import { SecretsManager, RDSDataService } from 'aws-sdk';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const secretsManager = new SecretsManager();
const rdsDataService = new RDSDataService();

// Cache for database connection details
let dbSecretCache: any = null;
let clusterArnCache: string | null = null;
let dbNameCache: string | null = null;

// Get database connection parameters from Secrets Manager
async function getDbConfig() {
  if (dbSecretCache && clusterArnCache && dbNameCache) {
    return { 
      resourceArn: clusterArnCache, 
      secretArn: dbSecretCache.ARN, 
      database: dbNameCache 
    };
  }
  
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable not set');
  }
  
  const dbName = process.env.DB_NAME;
  if (!dbName) {
    throw new Error('DB_NAME environment variable not set');
  }
  
  const secretResponse = await secretsManager.getSecretValue({ SecretId: secretArn }).promise();
  
  if (!secretResponse.SecretString) {
    throw new Error('Failed to retrieve database credentials');
  }
  
  const secret = JSON.parse(secretResponse.SecretString);
  const clusterArn = secret.host; // The secret contains the cluster ARN as 'host'
  
  // Cache the values
  dbSecretCache = { ARN: secretArn };
  clusterArnCache = clusterArn;
  dbNameCache = dbName;
  
  return {
    resourceArn: clusterArn,
    secretArn: secretArn,
    database: dbName
  };
}

// Standardize API responses
function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,GET,POST'
    },
    body: JSON.stringify(body)
  };
}

// Handler for API Gateway events
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  try {
    const operation = event.path.split('/').pop() || '';
    const queryParams = event.queryStringParameters || {};
    let body: any = {};
    
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        console.error('Error parsing request body:', e);
      }
    }
    
    const dbConfig = await getDbConfig();
    
    switch (operation) {
      case 'GetCustomers':
        return await handleGetCustomers(dbConfig, queryParams.CustomerID);
      case 'GetProducts':
        return await handleGetProducts(dbConfig, queryParams.ProductID);
      case 'GetOrders':
        return await handleGetOrders(dbConfig, queryParams.CustomerID, queryParams.ProductID);
      case 'TransactOrder':
        return await handleTransactOrder(dbConfig, body);
      default:
        return createResponse(400, { success: false, message: 'Unknown operation' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse(500, { 
      success: false, 
      message: 'Internal server error',
      error: (error as Error).message 
    });
  }
}

// Get customers with optional filter by ID
async function handleGetCustomers(dbConfig: any, customerId?: string): Promise<APIGatewayProxyResult> {
  try {
    let sql = 'SELECT * FROM customers';
    let parameters = [];
    
    if (customerId) {
      sql += ' WHERE customer_id = :customerId';
      parameters.push({
        name: 'customerId',
        value: { stringValue: customerId }
      });
    }
    
    const result = await rdsDataService.executeStatement({
      resourceArn: dbConfig.resourceArn,
      secretArn: dbConfig.secretArn,
      database: dbConfig.database,
      sql,
      parameters
    }).promise();
    
    const customers = mapResultsToObjects(result);
    
    return createResponse(200, {
      success: true,
      data: customers.map(customer => ({
        CustomerID: customer.customer_id,
        Name: customer.name,
        Email: customer.email,
        Phone: customer.phone,
        Address: customer.address
      }))
    });
  } catch (error) {
    console.error('Error getting customers:', error);
    return createResponse(500, { 
      success: false, 
      message: 'Failed to retrieve customers',
      error: (error as Error).message 
    });
  }
}

// Get products with optional filter by ID
async function handleGetProducts(dbConfig: any, productId?: string): Promise<APIGatewayProxyResult> {
  try {
    let sql = 'SELECT * FROM products';
    let parameters = [];
    
    if (productId) {
      sql += ' WHERE product_id = :productId';
      parameters.push({
        name: 'productId',
        value: { stringValue: productId }
      });
    }
    
    const result = await rdsDataService.executeStatement({
      resourceArn: dbConfig.resourceArn,
      secretArn: dbConfig.secretArn,
      database: dbConfig.database,
      sql,
      parameters
    }).promise();
    
    const products = mapResultsToObjects(result);
    
    return createResponse(200, {
      success: true,
      data: products.map(product => ({
        ProductID: product.product_id,
        Name: product.name,
        Description: product.description,
        Price: parseFloat(product.price),
        Category: product.category
      }))
    });
  } catch (error) {
    console.error('Error getting products:', error);
    return createResponse(500, { 
      success: false, 
      message: 'Failed to retrieve products',
      error: (error as Error).message 
    });
  }
}

// Get orders with filters
async function handleGetOrders(
  dbConfig: any, 
  customerId?: string, 
  productId?: string
): Promise<APIGatewayProxyResult> {
  try {
    let sql = `
      SELECT o.*, c.name as customer_name, p.name as product_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products p ON o.product_id = p.product_id
    `;
    
    let parameters = [];
    const conditions = [];
    
    if (customerId) {
      conditions.push('o.customer_id = :customerId');
      parameters.push({
        name: 'customerId',
        value: { stringValue: customerId }
      });
    }
    
    if (productId) {
      conditions.push('o.product_id = :productId');
      parameters.push({
        name: 'productId',
        value: { stringValue: productId }
      });
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY o.order_date DESC';
    
    const result = await rdsDataService.executeStatement({
      resourceArn: dbConfig.resourceArn,
      secretArn: dbConfig.secretArn,
      database: dbConfig.database,
      sql,
      parameters
    }).promise();
    
    const orders = mapResultsToObjects(result);
    
    return createResponse(200, {
      success: true,
      data: orders.map(order => ({
        OrderID: order.order_id,
        CustomerID: order.customer_id,
        ProductID: order.product_id,
        Quantity: parseInt(order.quantity, 10),
        OrderDate: order.order_date,
        CustomerName: order.customer_name,
        ProductName: order.product_name
      }))
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    return createResponse(500, { 
      success: false, 
      message: 'Failed to retrieve orders',
      error: (error as Error).message 
    });
  }
}

// Create a new order transaction
async function handleTransactOrder(dbConfig: any, requestBody: any): Promise<APIGatewayProxyResult> {
  try {
    if (!requestBody.CustomerID || !requestBody.ProductID) {
      return createResponse(400, { 
        success: false, 
        message: 'CustomerID and ProductID are required' 
      });
    }
    
    // Check if customer exists
    const customerResult = await rdsDataService.executeStatement({
      resourceArn: dbConfig.resourceArn,
      secretArn: dbConfig.secretArn,
      database: dbConfig.database,
      sql: 'SELECT * FROM customers WHERE customer_id = :customerId',
      parameters: [{
        name: 'customerId',
        value: { stringValue: requestBody.CustomerID }
      }]
    }).promise();
    
    if (!customerResult.records || customerResult.records.length === 0) {
      return createResponse(404, { 
        success: false, 
        message: `Customer with ID ${requestBody.CustomerID} not found` 
      });
    }
    
    // Check if product exists
    const productResult = await rdsDataService.executeStatement({
      resourceArn: dbConfig.resourceArn,
      secretArn: dbConfig.secretArn,
      database: dbConfig.database,
      sql: 'SELECT * FROM products WHERE product_id = :productId',
      parameters: [{
        name: 'productId',
        value: { stringValue: requestBody.ProductID }
      }]
    }).promise();
    
    if (!productResult.records || productResult.records.length === 0) {
      return createResponse(404, { 
        success: false, 
        message: `Product with ID ${requestBody.ProductID} not found` 
      });
    }
    
    // Generate a new order ID
    const orderIdResult = await rdsDataService.executeStatement({
      resourceArn: dbConfig.resourceArn,
      secretArn: dbConfig.secretArn,
      database: dbConfig.database,
      sql: 'SELECT MAX(CAST(order_id AS INTEGER)) as max_id FROM orders'
    }).promise();
    
    const maxId = orderIdResult.records?.[0][0].longValue || 0;
    const newOrderId = (maxId + 1).toString().padStart(7, '0');
    
    // Create the order
    await rdsDataService.executeStatement({
      resourceArn: dbConfig.resourceArn,
      secretArn: dbConfig.secretArn,
      database: dbConfig.database,
      sql: `
        INSERT INTO orders (order_id, customer_id, product_id, quantity, order_date)
        VALUES (:orderId, :customerId, :productId, :quantity, CURRENT_DATE)
      `,
      parameters: [
        { name: 'orderId', value: { stringValue: newOrderId } },
        { name: 'customerId', value: { stringValue: requestBody.CustomerID } },
        { name: 'productId', value: { stringValue: requestBody.ProductID } },
        { name: 'quantity', value: { longValue: requestBody.Quantity || 1 } }
      ]
    }).promise();
    
    return createResponse(201, {
      success: true,
      message: `Order ${newOrderId} created successfully`,
      orderId: newOrderId
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return createResponse(500, { 
      success: false, 
      message: 'Failed to create order',
      error: (error as Error).message 
    });
  }
}

// Helper function to map RDS Data API results to objects
function mapResultsToObjects(result: RDSDataService.ExecuteStatementResponse): any[] {
  if (!result.records || result.records.length === 0) {
    return [];
  }
  
  const columnMetadata = result.columnMetadata || [];
  const columnNames = columnMetadata.map(col => col.name);
  
  return result.records.map(record => {
    const obj: any = {};
    
    record.forEach((field, index) => {
      const columnName = columnNames[index];
      if (columnName) {
        // Extract value based on field type
        const value = Object.values(field)[0];
        obj[columnName] = value;
      }
    });
    
    return obj;
  });
}
