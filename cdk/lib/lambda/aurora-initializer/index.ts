
import { SecretsManager } from 'aws-sdk';
import { Client } from 'pg';
import * as AWS from 'aws-sdk';

/**
 * Environment variables used by the function
 */
const {
  DB_CLUSTER_ENDPOINT,
  DB_NAME,
  DB_SECRET_ARN,
} = process.env;

/**
 * Secret manager client for retrieving database credentials
 */
const secretsManager = new SecretsManager();

/**
 * Handler for the custom resource
 */
export async function handler(event: any): Promise<any> {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { RequestType, ResourceProperties } = event;
  
  try {
    switch (RequestType) {
      case 'Create':
      case 'Update':
        return await handleCreateOrUpdate(ResourceProperties);
      case 'Delete':
        return await handleDelete(ResourceProperties);
      default:
        throw new Error(`Unsupported request type: ${RequestType}`);
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Handles create or update events
 */
async function handleCreateOrUpdate(properties: any): Promise<any> {
  const {
    DBClusterEndpoint,
    DBName,
    DDLFiles,
    SeedDataFiles,
    TestFiles,
    SQLFileContents,
  } = properties;
  
  console.log('Starting database initialization');
  console.log(`Database: ${DBName}`);
  console.log(`Endpoint: ${DBClusterEndpoint}`);
  
  // Get database credentials
  const secretData = await getSecret(DB_SECRET_ARN!);
  const { username, password } = secretData;
  
  // Initialize the database with DDL files
  console.log('Executing DDL files');
  for (const file of DDLFiles) {
    console.log(`Executing DDL file: ${file}`);
    await executeSQL(DBClusterEndpoint, DBName, username, password, SQLFileContents[file]);
  }
  
  // Initialize the database with seed data files
  if (SeedDataFiles && SeedDataFiles.length > 0) {
    console.log('Executing seed data files');
    for (const file of SeedDataFiles) {
      console.log(`Executing seed data file: ${file}`);
      await executeSQL(DBClusterEndpoint, DBName, username, password, SQLFileContents[file]);
    }
  }
  
  // Initialize the database with test data files
  if (TestFiles && TestFiles.length > 0) {
    console.log('Executing test data files');
    for (const file of TestFiles) {
      console.log(`Executing test data file: ${file}`);
      await executeSQL(DBClusterEndpoint, DBName, username, password, SQLFileContents[file]);
    }
  }
  
  console.log('Database initialization complete');
  return {
    PhysicalResourceId: `${DBName}-initializer`,
    Data: {
      DBName,
    },
  };
}

/**
 * Handles delete events
 */
async function handleDelete(properties: any): Promise<any> {
  const {
    DBClusterEndpoint,
    DBName,
  } = properties;
  
  console.log(`Preparing to delete database: ${DBName}`);
  
  try {
    // Get database credentials
    const secretData = await getSecret(DB_SECRET_ARN!);
    const { username, password } = secretData;

    // Connect to the database
    const client = await connectToDatabase(DBClusterEndpoint, 'postgres', username, password);
    
    try {
      // Terminate active connections to the database
      console.log(`Terminating active connections to database: ${DBName}`);
      await client.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${DBName}'
        AND pid <> pg_backend_pid();
      `);
      
      // Drop the database
      console.log(`Dropping database: ${DBName}`);
      await client.query(`DROP DATABASE IF EXISTS "${DBName}"`);
      
      console.log(`Database ${DBName} deleted successfully`);
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error(`Error deleting database ${DBName}:`, error);
    // For delete operations, we don't want to fail the stack deletion if the database is already gone
    console.log('Continuing with resource deletion');
  }
  
  return {
    PhysicalResourceId: `${DBName}-initializer`,
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
 * Executes SQL commands in a database
 */
async function executeSQL(
  host: string,
  database: string,
  username: string,
  password: string,
  sqlCommands: string
): Promise<void> {
  let client;
  
  try {
    client = await connectToDatabase(host, database, username, password);
    
    // Split commands on semicolons and filter out empty statements
    const statements = sqlCommands
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`Executing ${statements.length} SQL statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}`);
      
      try {
        await client.query(statement);
      } catch (error) {
        console.error(`Error executing SQL statement: ${error}`);
        console.error('Failed statement:', statement);
        throw error;
      }
    }
    
    console.log('SQL execution complete');
  } finally {
    if (client) {
      await client.end();
      console.log('Database connection closed');
    }
  }
}
