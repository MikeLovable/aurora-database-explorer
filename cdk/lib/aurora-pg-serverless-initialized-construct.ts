
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Properties for the AuroraPGServerlessInitializedConstruct
 */
export interface AuroraPGServerlessInitializedConstructProps {
  /**
   * The VPC to deploy the database into
   */
  vpc: ec2.IVpc;
  
  /**
   * The name of the database to create
   */
  dbName: string;
  
  /**
   * The engine version for Aurora PostgreSQL
   * @default - The latest version
   */
  auroraPostgresEngineVersion?: string;
  
  /**
   * The serverless capacity settings
   * @default - Minimum: 0.5 ACU, Maximum: 2 ACUs
   */
  auroraCapacityUnit?: {
    minCapacity: number;
    maxCapacity: number;
  };
  
  /**
   * The path to the directory containing SQL files
   */
  sqlFiles: string;
  
  /**
   * An array of filenames for DDL SQL files
   * These files will be executed in order to create tables and relationships
   */
  ddlFiles: string[];
  
  /**
   * An array of filenames for seed data SQL files
   * These files will be executed to populate initial data
   */
  seedDataFiles: string[];
  
  /**
   * An array of filenames for test data SQL files
   * These files will be executed to populate test data
   */
  testFiles: string[];
}

/**
 * A CDK construct that creates an Aurora PostgreSQL Serverless V2 database
 * and initializes it with SQL scripts
 */
export class AuroraPGServerlessInitializedConstruct extends Construct {
  /**
   * The name of the database
   */
  public readonly dbName: string;
  
  /**
   * The Aurora database cluster
   */
  public readonly dbCluster: rds.ServerlessCluster;
  
  /**
   * The secret containing admin credentials for the database
   */
  public readonly dbUserAdminSecret: secretsmanager.Secret;
  
  /**
   * The secret containing application credentials for the database
   */
  public readonly dbUserAppSecret: secretsmanager.Secret;
  
  /**
   * The secret containing custom resource credentials for the database
   */
  public readonly dbUserCustomResourceSecret: secretsmanager.Secret;
  
  constructor(scope: Construct, id: string, props: AuroraPGServerlessInitializedConstructProps) {
    super(scope, id);

    // Store the database name for use in outputs
    this.dbName = props.dbName;

    // Create secrets for database users
    this.dbUserAdminSecret = new secretsmanager.Secret(this, 'DBUserAdmin', {
      secretName: `${id}-admin-credentials`,
      description: 'Admin credentials for Aurora PostgreSQL database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludeCharacters: '/\\@"%',
      },
    });

    this.dbUserAppSecret = new secretsmanager.Secret(this, 'DBUserApp', {
      secretName: `${id}-app-credentials`,
      description: 'Application credentials for Aurora PostgreSQL database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'app_user' }),
        generateStringKey: 'password',
        excludeCharacters: '/\\@"%',
      },
    });

    this.dbUserCustomResourceSecret = new secretsmanager.Secret(this, 'DBUserCustomResource', {
      secretName: `${id}-cr-credentials`,
      description: 'Custom resource credentials for Aurora PostgreSQL database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'cr_user' }),
        generateStringKey: 'password',
        excludeCharacters: '/\\@"%',
      },
    });

    // Create a security group for the database
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Aurora PostgreSQL Serverless cluster',
      allowAllOutbound: true,
    });

    // Create the Aurora PostgreSQL Serverless V2 cluster
    this.dbCluster = new rds.ServerlessCluster(this, 'AuroraSV2DB', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_6,
      }),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      defaultDatabaseName: props.dbName,
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.dbUserAdminSecret),
      scaling: {
        autoPause: cdk.Duration.hours(1),
        minCapacity: props.auroraCapacityUnit?.minCapacity ?? 0.5,
        maxCapacity: props.auroraCapacityUnit?.maxCapacity ?? 2,
      },
      backupRetention: cdk.Duration.days(7),
    });

    // Verify SQL files exist
    const allSqlFiles = [...props.ddlFiles, ...props.seedDataFiles, ...props.testFiles];
    for (const file of allSqlFiles) {
      const filePath = path.join(props.sqlFiles, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`SQL file not found: ${filePath}`);
      }
    }

    // Create the initializer function for the Aurora PostgreSQL database
    const initializerFunction = new lambda.Function(this, 'AuroraPostgreSQLInitializerFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/aurora-initializer')),
      timeout: cdk.Duration.minutes(15),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [dbSecurityGroup],
      environment: {
        DB_CLUSTER_ENDPOINT: this.dbCluster.clusterEndpoint.hostname,
        DB_NAME: props.dbName,
        DB_SECRET_ARN: this.dbUserCustomResourceSecret.secretArn,
      },
    });

    // Grant the initializer function permission to read the database secret
    this.dbUserCustomResourceSecret.grantRead(initializerFunction);

    // Allow the function to connect to the database
    this.dbCluster.connections.allowFrom(
      initializerFunction,
      ec2.Port.tcp(this.dbCluster.clusterEndpoint.port)
    );

    // Create the custom resource provider for initializing the database
    const initializerProvider = new cr.Provider(this, 'AuroraPostgreSQLInitializerCR', {
      onEventHandler: initializerFunction,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    // Read SQL files and provide them as custom resource properties
    const sqlFileContents: Record<string, string> = {};
    for (const file of allSqlFiles) {
      const filePath = path.join(props.sqlFiles, file);
      sqlFileContents[file] = fs.readFileSync(filePath, 'utf8');
    }

    // Create the custom resource to initialize the database
    const initializer = new cdk.CustomResource(this, 'DatabaseInitializer', {
      serviceToken: initializerProvider.serviceToken,
      properties: {
        DBClusterEndpoint: this.dbCluster.clusterEndpoint.hostname,
        DBName: props.dbName,
        DDLFiles: props.ddlFiles,
        SeedDataFiles: props.seedDataFiles,
        TestFiles: props.testFiles,
        SQLFileContents: sqlFileContents,
        Version: Date.now().toString(), // Force update on each deployment
      },
    });

    // Ensure the initializer runs after the database is created
    initializer.node.addDependency(this.dbCluster);
  }
}
