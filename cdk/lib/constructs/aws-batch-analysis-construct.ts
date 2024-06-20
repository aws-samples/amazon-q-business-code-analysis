import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as batch from "aws-cdk-lib/aws-batch";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";

export interface AwsBatchAnalysisProps extends cdk.StackProps {
  readonly qAppName: string;
  readonly qAppId: string;
  readonly qAppIndexId: string
  readonly qAppDataSourceId: string;
  readonly qAppRoleArn: string;
  readonly repository: string;
  readonly boto3Layer: lambda.LayerVersion;
  readonly sshUrl: string;
  readonly sshKeyName: string;
  readonly neptuneGraphId: string;
  readonly enableGraphParam: cdk.CfnParameter;
  readonly enableResearchAgentParam: cdk.CfnParameter;
}

const defaultProps: Partial<AwsBatchAnalysisProps> = {};

export class AwsBatchAnalysisConstruct extends Construct {

    constructor(scope: Construct, name: string, props: AwsBatchAnalysisProps) {
      super(scope, name);

      props = { ...defaultProps, ...props };

      const awsAccountId = cdk.Stack.of(this).account;

      // Upload the code to S3
      const s3Bucket = new cdk.aws_s3.Bucket(this, 'CodeProcessingBucket', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
      });

      new cdk.aws_s3_deployment.BucketDeployment(this, "CodeProcessingBucketScript", {
        sources: [
          cdk.aws_s3_deployment.Source.asset(
              "lib/assets/scripts/documentation_generation"
          ),
        ],
        destinationBucket: s3Bucket,
        destinationKeyPrefix: "code-processing",
      });

      if (cdk.Fn.conditionEquals(props.enableResearchAgentParam.valueAsString, 'true')) {
        new cdk.aws_s3_deployment.BucketDeployment(this, "AgentBucketScript", {
          sources: [
            cdk.aws_s3_deployment.Source.asset(
                "lib/assets/scripts/research_agent"
            ),
          ],
          destinationBucket: s3Bucket,
          destinationKeyPrefix: "research-agent",
        });
      }

      const vpc = new ec2.Vpc(this, 'Vpc', {
        maxAzs: 2,
      });

      const computeEnvironment = new batch.FargateComputeEnvironment(this, 'QScriptComputeEnv', {
        vpc,
      });

      const jobQueue = new batch.JobQueue(this, 'QProcessingJobQueue', {
        priority: 1,
        computeEnvironments: [
          {
            computeEnvironment,
            order: 1,
          },
        ],
      });

      const jobExecutionRole = new cdk.aws_iam.Role(this, 'QProcessingJobExecutionRole', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      jobExecutionRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "qbusiness:ChatSync",
          "qbusiness:BatchPutDocument",
          "qbusiness:BatchDeleteDocument",
          "qbusiness:StartDataSourceSyncJob",
          "qbusiness:StopDataSourceSyncJob",
        ],
        resources: [
          `arn:aws:qbusiness:${cdk.Stack.of(this).region}:${awsAccountId}:application/*`,
        ],
      }));
      // Grant Job Execution Role access to logging
      jobExecutionRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [
          `arn:aws:logs:${cdk.Stack.of(this).region}:${awsAccountId}:log-group:/aws/batch/*`,
        ],
      }));

      // Allow pass role
      jobExecutionRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "iam:PassRole",
        ],
        resources: [props.qAppRoleArn],
      }));

      // Add Invoke model permission to the role
      jobExecutionRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
        ],
        resources: [
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        ],
      }));

      s3Bucket.grantReadWrite(jobExecutionRole);

      const jobDefinition = new batch.EcsJobDefinition(this, 'QBusinessJob', {
        container: new batch.EcsFargateContainerDefinition(this, 'Container', {
          image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest'),
          memory: cdk.Size.gibibytes(2),
          cpu: 1,
          executionRole: jobExecutionRole,
          jobRole: jobExecutionRole,
          ephemeralStorageSize: cdk.Size.gibibytes(21),
        }),
      });

      // Grant Job Execution Role to read from Secrets manager if ssh key is provided
      jobExecutionRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "secretsmanager:GetSecretValue",
        ],
        resources: [
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${awsAccountId}:secret:${props.sshKeyName}-??????`
        ],
      }));

      // Bedrock Claude 3 sonnet permission
      jobExecutionRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          'bedrock:InvokeModel',
        ],
        resources: [
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/amazon.titan-embed-text-v1`,
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/anthropic.claude-3-opus-20240229-v1:0`,
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/anthropic.claude-3-haiku-20240229-v1:1`,
        ]
      }));

      // Add graph permissions
      jobExecutionRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "neptune-graph:DeleteDataViaQuery", 
          "neptune-graph:ReadDataViaQuery", 
          "neptune-graph:WriteDataViaQuery"
        ],
        resources: [
          `arn:aws:neptune-graph:${cdk.Stack.of(this).region}:${awsAccountId}:graph/${props.neptuneGraphId}`,
        ]})
      );


      // Role to submit job
      const submitJobRole = new cdk.aws_iam.Role(this, 'QBusinessSubmitJobRole', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      });

      submitJobRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "qbusiness:ListApplications",
          "qbusiness:ListIndices",
        ],
        resources: [
          `*`,
        ],
      }));

      submitJobRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "iam:PassRole",
        ],
        resources: [jobExecutionRole.roleArn],
      }));

      // Submit Job Role CloudWatch Logs
      submitJobRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [
          `arn:aws:logs:${cdk.Stack.of(this).region}:${awsAccountId}:log-group:/aws/lambda/*`,
        ],
      }));

      // Lambda to submit job
      const submitBatchAnalysisJob  = new lambda.Function(this, 'QBusinesssubmitBatchAnalysisJob', {
        code: lambda.Code.fromAsset('lib/assets/lambdas/batch_lambdas'),
        handler: 'submit_batch_job.on_event',
        runtime: lambda.Runtime.PYTHON_3_12,
        environment: {
          BATCH_JOB_DEFINITION: jobDefinition.jobDefinitionArn,
          BATCH_JOB_QUEUE: jobQueue.jobQueueArn,
          REPO_URL: props.repository,
          AMAZON_Q_APP_ID: props.qAppId,
          Q_APP_NAME: props.qAppName,
          Q_APP_DATA_SOURCE_ID: props.qAppDataSourceId,
          Q_APP_INDEX: props.qAppIndexId,
          Q_APP_ROLE_ARN: props.qAppRoleArn,
          S3_BUCKET: s3Bucket.bucketName,
          SSH_URL: props.sshUrl,
          SSH_KEY_NAME: props.sshKeyName,
          ENABLE_GRAPH: props.enableGraphParam.valueAsString,
          NEPTUNE_GRAPH_ID: props.neptuneGraphId,
        },
        layers: [props.boto3Layer],
        role: submitJobRole,
        timeout: cdk.Duration.minutes(5),
        memorySize: 512,
      });

      submitBatchAnalysisJob.node.addDependency(jobDefinition);

      jobDefinition.grantSubmitJob(submitJobRole, jobQueue);

      // Custom resource to invoke the lambda
      const submitBatchAnalysisJobProvider = new cdk.custom_resources.Provider(this, 'QBuinesssubmitBatchAnalysisJobProvider', {
        onEventHandler: submitBatchAnalysisJob,
        logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
      });

      new cdk.CustomResource(this, 'QBusinesssubmitBatchAnalysisJobCustomResource', {
        serviceToken: submitBatchAnalysisJobProvider.serviceToken,
      });

      if (cdk.Fn.conditionEquals(props.enableResearchAgentParam.valueAsString, 'true')) {

        // Add another lambda that invokes the file submit_agent_job.py
        const submitAgentJobLambda = new lambda.Function(this, 'QBusinessSubmitAgentJobLambda', {
          code: lambda.Code.fromAsset('lib/assets/lambdas/batch_lambdas'),
          handler: 'submit_agent_job.on_event',
          runtime: lambda.Runtime.PYTHON_3_12,
          environment: {
            BATCH_JOB_DEFINITION: jobDefinition.jobDefinitionArn,
            BATCH_JOB_QUEUE: jobQueue.jobQueueArn,
            REPO_URL: props.repository,
            AMAZON_Q_APP_ID: props.qAppId,
            Q_APP_NAME: props.qAppName,
            Q_APP_DATA_SOURCE_ID: props.qAppDataSourceId,
            Q_APP_INDEX: props.qAppIndexId,
            Q_APP_ROLE_ARN: props.qAppRoleArn,
            S3_BUCKET: s3Bucket.bucketName,
            SSH_URL: props.sshUrl,
            SSH_KEY_NAME: props.sshKeyName,
            ENABLE_GRAPH: props.enableGraphParam.valueAsString,
            NEPTUNE_GRAPH_ID: props.neptuneGraphId,
          },
          layers: [props.boto3Layer],
          role: submitJobRole,
          timeout: cdk.Duration.minutes(5),
          memorySize: 512,
        });

        submitAgentJobLambda.node.addDependency(jobDefinition);

        // Custom resource to invoke the lambda
        const submitAgentJobLambdaProvider = new cdk.custom_resources.Provider(this, 'QBuinessSubmitAgentJobLambdaProvider', {
          onEventHandler: submitAgentJobLambda,
          logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
        });

        new cdk.CustomResource(this, 'QBusinessSubmitAgentJobLambdaCustomResource', {
          serviceToken: submitAgentJobLambdaProvider.serviceToken,
        });

      }

      // Output Job Queue
      new cdk.CfnOutput(this, 'JobQueue', {
        value: jobQueue.jobQueueArn,
      });

      // Output Job Execution Role
      new cdk.CfnOutput(this, 'JobExecutionRole', {
        value: jobExecutionRole.roleArn,
      });

    }
}