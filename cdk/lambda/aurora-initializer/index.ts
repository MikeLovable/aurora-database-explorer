
import { SecretsManager, RDSDataService } from 'aws-sdk';
import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';

const secretsManager = new SecretsManager();
const rdsDataService = new RDSDataService();

// Handler for AWS CloudFormation custom resource
export async function handler(event: CloudFormationCustomResourceEvent): Promise<CloudFormationCustomResourceResponse> {
  console.log('Event received:', JSON.stringify(event, null, 2));

  // Extract environment variables
  const clusterArn = process.env.CLUSTER_ARN;
  const dbName = process.env.DB_NAME;
  const adminSecretArn = process.env.ADMIN_SECRET_ARN;
  const appSecretArn = process.env.APP_SECRET_ARN;
  const crSecretArn = process.env.CR_SECRET_ARN;
  
  if (!clusterArn || !dbName || !adminSecretArn || !appSecretArn || !crSecretArn) {
    throw new Error('Required environment variables not set');
  }

  const physicalResourceId = `DB-Initialization-${dbName}`;
  
  try {
    // Process based on CloudFormation event type
    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      // Get secrets
      const adminSecret = await getSecret(adminSecretArn);
      const appSecret = await getSecret(appSecretArn);
      const crSecret = await getSecret(crSecretArn);
      
      // Initialize database
      await initializeDatabase(
        clusterArn,
        dbName,
        adminSecretArn,
        appSecret.username,
        appSecret.password,
        crSecret.username,
        crSecret.password
      );
      
      // Execute SQL scripts
      const sqlScripts = event.ResourceProperties.sqlScripts || [];
      
      for (const script of sqlScripts) {
        if (script.content) {
          console.log(`Executing SQL script: ${script.path}`);
          await executeSQL(clusterArn, adminSecretArn, dbName, script.content);
        } else if (script.error) {
          console.error(`Error with SQL script ${script.path}: ${script.error}`);
        }
      }
      
      // Return success
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: physicalResourceId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        StackId: event.StackId,
        Data: { Message: 'Database initialization completed successfully' }
      };
    } else if (event.RequestType === 'Delete') {
      // Nothing to do for deletion - RDS cluster will be deleted by CloudFormation
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: physicalResourceId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        StackId: event.StackId,
        Data: { Message: 'No deletion actions required' }
      };
    } else {
      throw new Error(`Unsupported request type: ${event.RequestType}`);
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      Status: 'FAILED',
      PhysicalResourceId: physicalResourceId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      StackId: event.StackId,
      Reason: (error as Error).message
    };
  }
}

// Retrieve secret from AWS Secrets Manager
async function getSecret(secretArn: string): Promise<any> {
  const response = await secretsManager.getSecretValue({ SecretId: secretArn }).promise();
  
  if (!response.SecretString) {
    throw new Error(`Failed to retrieve secret ${secretArn}`);
  }
  
  return JSON.parse(response.SecretString);
}

// Initialize database with users and permissions
async function initializeDatabase(
  clusterArn: string,
  dbName: string,
  adminSecretArn: string,
  appUsername: string,
  appPassword: string,
  crUsername: string,
  crPassword: string
): Promise<void> {
  try {
    // Create app user
    await rdsDataService.executeStatement({
      resourceArn: clusterArn,
      secretArn: adminSecretArn,
      database: dbName,
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${appUsername}') THEN
            CREATE USER ${appUsername} WITH PASSWORD '${appPassword}';
          ELSE
            ALTER USER ${appUsername} WITH PASSWORD '${appPassword}';
          END IF;
        END
        $$;
        
        GRANT USAGE ON SCHEMA public TO ${appUsername};
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appUsername};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${appUsername};
      `
    }).promise();
    
    // Create custom resource user
    await rdsDataService.executeStatement({
      resourceArn: clusterArn,
      secretArn: adminSecretArn,
      database: dbName,
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${crUsername}') THEN
            CREATE USER ${crUsername} WITH PASSWORD '${crPassword}';
          ELSE
            ALTER USER ${crUsername} WITH PASSWORD '${crPassword}';
          END IF;
        END
        $$;
        
        GRANT USAGE ON SCHEMA public TO ${crUsername};
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${crUsername};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${crUsername};
      `
    }).promise();
    
    console.log('Database users created and permissions granted');
  } catch (error) {
    console.error('Error initializing database users:', error);
    throw error;
  }
}

// Execute SQL statements
async function executeSQL(
  clusterArn: string,
  secretArn: string,
  database: string,
  sqlScript: string
): Promise<void> {
  // Split script into individual statements (naive approach)
  const statements = sqlScript
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    try {
      await rdsDataService.executeStatement({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database,
        sql
      }).promise();
    } catch (error) {
      console.error(`Error executing SQL statement ${i + 1}:`, error);
      console.error('Statement:', sql);
      throw error;
    }
  }
}
