
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';

interface AuroraPGServerlessInitializedConstructProps {
  vpc: ec2.IVpc;
  databaseName: string;
  sqlScriptPaths: string[];
}

export class AuroraPGServerlessInitializedConstruct extends Construct {
  public readonly cluster: rds.ServerlessCluster;
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

    // Create Aurora Serverless cluster
    this.cluster = new rds.ServerlessCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_6
      }),
      defaultDatabaseName: props.databaseName,
      enableDataApi: true,
      vpc: props.vpc,
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.adminSecret),
      scaling: {
        autoPause: cdk.Duration.minutes(10),
        minCapacity: rds.AuroraCapacityUnit.ACU_2,
        maxCapacity: rds.AuroraCapacityUnit.ACU_8
      }
    });

    // Create Lambda function for database initialization
    const dbInitFunction = new lambda.Function(this, 'DatabaseInitializer', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/aurora-initializer')),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        CLUSTER_ARN: this.cluster.clusterArn,
        DB_NAME: props.databaseName,
        ADMIN_SECRET_ARN: this.adminSecret.secretArn,
        APP_SECRET_ARN: this.appUserSecret.secretArn,
        CR_SECRET_ARN: this.customResourceSecret.secretArn
      },
      timeout: cdk.Duration.minutes(5)
    });

    // Grant Data API access to the initializer function
    this.cluster.grantDataApiAccess(dbInitFunction);

    // Grant access to Secrets Manager
    this.adminSecret.grantRead(dbInitFunction);
    this.appUserSecret.grantRead(dbInitFunction);
    this.customResourceSecret.grantRead(dbInitFunction);

    // Create a custom resource provider for initialization
    const provider = new cr.Provider(this, 'InitializationProvider', {
      onEventHandler: dbInitFunction
    });

    // Create custom resource for database initialization
    const customResource = new cdk.CustomResource(this, 'DatabaseInitialization', {
      serviceToken: provider.serviceToken,
      properties: {
        // Force execution on every deployment by including a random value
        random: Math.random().toString(),
        sqlScripts: props.sqlScriptPaths.map(scriptPath => {
          try {
            return { path: scriptPath, content: cdk.Fn.readFileSync(scriptPath) };
          } catch (e) {
            return { path: scriptPath, error: `Failed to read file: ${e}` };
          }
        })
      }
    });
  }

  // Grant Data API access to the provided principal
  public grantDataApiAccess(grantee: iam.IGrantable) {
    this.cluster.grantDataApiAccess(grantee);
    this.appUserSecret.grantRead(grantee);
  }
}
