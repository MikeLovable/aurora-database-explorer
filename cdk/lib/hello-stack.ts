
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { AuroraPGServerlessInitializedConstruct } from './aurora-pg-serverless-initialized-construct';

/**
 * Main stack for the HelloDB application
 */
export class HelloStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create a VPC for our resources
    const demoVpc = new ec2.Vpc(this, 'DemoVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // 2. Create the Aurora PostgreSQL database using our custom construct
    const database = new AuroraPGServerlessInitializedConstruct(this, 'HelloDatabase', {
      vpc: demoVpc,
      dbName: 'hellodb',
      auroraPostgresEngineVersion: '14.6',
      auroraCapacityUnit: {
        minCapacity: 0.5, // Minimum ACUs
        maxCapacity: 1,   // Maximum ACUs (for cost control)
      },
      sqlFiles: path.join(__dirname, '..', 'sql'),
      ddlFiles: ['01_create_tables.sql', '02_create_relationships.sql'],
      seedDataFiles: [],
      testFiles: ['03_insert_test_customers.sql', '04_insert_test_products_and_orders.sql'],
    });

    // 3. Create the Lambda function for handling API requests
    const dataManagerFunction = new lambda.Function(this, 'DataManagerFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/data-manager')),
      environment: {
        DB_SECRET_ARN: database.dbUserAppSecret.secretArn,
      },
      timeout: cdk.Duration.seconds(30),
      vpc: demoVpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Grant Lambda access to database secrets
    database.dbUserAppSecret.grantRead(dataManagerFunction);

    // Allow Lambda to connect to database
    dataManagerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['rds-data:ExecuteStatement'],
        resources: [database.dbCluster.clusterArn],
      })
    );

    // 4. Create the API Gateway
    const dataManagerApi = new apigateway.RestApi(this, 'DataManagerAPI', {
      restApiName: 'DataManagerAPI',
      description: 'API for HelloDB database operations',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
    });

    // Add API Gateway resources for each endpoint
    
    // GetProducts resource
    const productsResource = dataManagerApi.root.addResource('GetProducts');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(dataManagerFunction, {
      requestTemplates: {
        'application/json': JSON.stringify({
          action: 'GetProducts',
          productId: '$input.params(\'ProductID\')',
        }),
      },
    }));

    // GetCustomers resource
    const customersResource = dataManagerApi.root.addResource('GetCustomers');
    customersResource.addMethod('GET', new apigateway.LambdaIntegration(dataManagerFunction, {
      requestTemplates: {
        'application/json': JSON.stringify({
          action: 'GetCustomers',
          customerId: '$input.params(\'CustomerID\')',
        }),
      },
    }));

    // GetOrders resource
    const ordersResource = dataManagerApi.root.addResource('GetOrders');
    ordersResource.addMethod('GET', new apigateway.LambdaIntegration(dataManagerFunction, {
      requestTemplates: {
        'application/json': JSON.stringify({
          action: 'GetOrders',
          customerId: '$input.params(\'CustomerID\')',
          productId: '$input.params(\'ProductID\')',
        }),
      },
    }));

    // TransactOrder resource
    const transactResource = dataManagerApi.root.addResource('TransactOrder');
    transactResource.addMethod('POST', new apigateway.LambdaIntegration(dataManagerFunction, {
      requestTemplates: {
        'application/json': JSON.stringify({
          action: 'TransactOrder',
          customerId: '$input.path(\'$.CustomerID\')',
          productId: '$input.path(\'$.ProductID\')',
        }),
      },
    }));

    // 5. Output important values
    new cdk.CfnOutput(this, 'VpcId', {
      value: demoVpc.vpcId,
      description: 'The ID of the VPC',
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: database.dbName,
      description: 'The name of the database',
    });

    new cdk.CfnOutput(this, 'DatabaseClusterArn', {
      value: database.dbCluster.clusterArn,
      description: 'The ARN of the database cluster',
    });

    new cdk.CfnOutput(this, 'AdminSecretArn', {
      value: database.dbUserAdminSecret.secretArn,
      description: 'The ARN of the admin database secret',
    });

    new cdk.CfnOutput(this, 'AppSecretArn', {
      value: database.dbUserAppSecret.secretArn,
      description: 'The ARN of the application database secret',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: dataManagerApi.url,
      description: 'The URL of the API Gateway',
    });
  }
}
