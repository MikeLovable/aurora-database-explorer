
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { AuroraPGServerlessInitializedConstruct } from '../constructs/aurora-pg-serverless-initialized-construct';

export class HelloStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC for network isolation
    const vpc = new ec2.Vpc(this, 'HelloVPC', {
      maxAzs: 2,
      natGateways: 1
    });

    // Create Aurora PostgreSQL Serverless database using our custom construct
    const aurora = new AuroraPGServerlessInitializedConstruct(this, 'HelloDB', {
      vpc,
      databaseName: 'hellodb',
      sqlScriptPaths: [
        'sql/01_create_tables.sql',
        'sql/02_create_relationships.sql',
        'sql/03_insert_test_customers.sql',
        'sql/04_insert_test_products_and_orders.sql'
      ]
    });

    // Create Lambda function for API handling
    const dataManagerFunction = new lambda.Function(this, 'DataManagerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/data-manager'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DB_SECRET_ARN: aurora.appUserSecret.secretArn,
        DB_NAME: 'hellodb'
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Allow the Lambda to access the database secret
    aurora.grantDataApiAccess(dataManagerFunction);

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'DataManagerAPI', {
      restApiName: 'Hello DB API',
      description: 'API for HelloDB application',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // Create API endpoints
    const apiResource = api.root;

    // GetCustomers endpoint
    const getCustomersIntegration = new apigateway.LambdaIntegration(dataManagerFunction, {
      requestTemplates: { 'application/json': '{ "operation": "GetCustomers", "payload": $input.json("$") }' }
    });
    apiResource.addResource('GetCustomers').addMethod('GET', getCustomersIntegration);

    // GetProducts endpoint
    const getProductsIntegration = new apigateway.LambdaIntegration(dataManagerFunction, {
      requestTemplates: { 'application/json': '{ "operation": "GetProducts", "payload": $input.json("$") }' }
    });
    apiResource.addResource('GetProducts').addMethod('GET', getProductsIntegration);

    // GetOrders endpoint
    const getOrdersIntegration = new apigateway.LambdaIntegration(dataManagerFunction, {
      requestTemplates: { 'application/json': '{ "operation": "GetOrders", "payload": $input.json("$") }' }
    });
    apiResource.addResource('GetOrders').addMethod('GET', getOrdersIntegration);

    // TransactOrder endpoint
    const transactOrderIntegration = new apigateway.LambdaIntegration(dataManagerFunction, {
      requestTemplates: { 'application/json': '{ "operation": "TransactOrder", "payload": $input.json("$") }' }
    });
    apiResource.addResource('TransactOrder').addMethod('POST', transactOrderIntegration);

    // Stack outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      description: 'API Gateway endpoint URL',
      value: api.url
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      description: 'Database credentials secret ARN',
      value: aurora.appUserSecret.secretArn
    });
  }
}
