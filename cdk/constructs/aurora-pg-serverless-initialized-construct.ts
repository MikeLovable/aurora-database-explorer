
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as fs from 'fs';

interface AuroraPGServerlessInitializedConstructProps {
  vpc: ec2.IVpc;
  databaseName: string;
  sqlScriptPaths: string[];
}

export class AuroraPGServerlessInitializedConstruct extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly adminSecret: secretsmanager.ISecret;
  public readonly appUserSecret: secretsmanager.ISecret;
  public readonly customResourceSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: AuroraPGServerlessInitializedConstructProps) {
    super(scope, id);

    // Create admin credentials secret
    this.adminSecret = new secretsmanager.Secret(this, 'AdminSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false
      }
    });

    // Create app user credentials secret
    this.appUserSecret = new secretsmanager.Secret(this, 'AppUserSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'app_user' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false
      }
    });

    // Create custom resource credentials secret
    this.customResourceSecret = new secretsmanager.Secret(this, 'CustomResourceSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'cr_user' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false
      }
    });

    // Create security group for database
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Aurora PostgreSQL database'
    });

    // Create Aurora PostgreSQL cluster with Serverless V2
    this.cluster = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_3 // Updated to valid version
      }),
      defaultDatabaseName: props.databaseName,
      credentials: rds.Credentials.fromSecret(this.adminSecret),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      securityGroups: [dbSecurityGroup],
      // Configure as Serverless v2 using the recommended pattern
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2.0,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: [
        rds.ClusterInstance.serverlessV2('reader1', {
          scaleWithWriter: true,
        }),
      ],
      deletionProtection: false,
    });

    // Create Lambda function for database initialization
    const dbInitFunction = new lambda.Function(this, 'DatabaseInitializer', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/aurora-initializer')),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        CLUSTER_ENDPOINT: this.cluster.clusterEndpoint.hostname,
        CLUSTER_PORT: this.cluster.clusterEndpoint.port.toString(),
        DB_NAME: props.databaseName,
        ADMIN_SECRET_ARN: this.adminSecret.secretArn,
        APP_SECRET_ARN: this.appUserSecret.secretArn,
        CR_SECRET_ARN: this.customResourceSecret.secretArn
      },
      timeout: cdk.Duration.minutes(5)
    });

    // Allow the function to connect to the DB
    this.cluster.connections.allowFrom(dbInitFunction, ec2.Port.tcp(this.cluster.clusterEndpoint.port));

    // Grant access to Secrets Manager
    this.adminSecret.grantRead(dbInitFunction);
    this.appUserSecret.grantRead(dbInitFunction);
    this.customResourceSecret.grantRead(dbInitFunction);

    // Create a custom resource provider for initialization
    const provider = new cr.Provider(this, 'InitializationProvider', {
      onEventHandler: dbInitFunction
    });

    // Read SQL files content
    const sqlScripts = props.sqlScriptPaths.map(scriptPath => {
      try {
        return { path: scriptPath, content: fs.readFileSync(scriptPath, 'utf8') };
      } catch (e) {
        return { path: scriptPath, error: `Failed to read file: ${e}` };
      }
    });

    // Create custom resource for database initialization
    const customResource = new cdk.CustomResource(this, 'DatabaseInitialization', {
      serviceToken: provider.serviceToken,
      properties: {
        // Force execution on every deployment by including a random value
        random: Math.random().toString(),
        sqlScripts: sqlScripts
      }
    });
  }

  // Grant database access to the provided principal
  public grantDataApiAccess(grantee: iam.IGrantable) {
    // For standard Aurora clusters (not Data API), grant read to the secrets
    this.appUserSecret.grantRead(grantee);
    
    // Add additional permissions for DB access through standard connection methods
    // since we're not using the Data API anymore
    if (grantee instanceof iam.Role) {
      this.cluster.connections.allowFrom(
        new ec2.Connections({
          securityGroups: [
            new ec2.SecurityGroup(this, `${grantee.node.id}SG`, {
              vpc: this.cluster.vpc,
              allowAllOutbound: true,
            }),
          ],
        }),
        ec2.Port.tcp(this.cluster.clusterEndpoint.port)
      );
    }
  }
}
