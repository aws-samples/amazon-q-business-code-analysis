"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsBatchAnalysisConstruct = void 0;
const cdk = require("aws-cdk-lib");
const constructs_1 = require("constructs");
const batch = require("aws-cdk-lib/aws-batch");
const ecs = require("aws-cdk-lib/aws-ecs");
const ec2 = require("aws-cdk-lib/aws-ec2");
const lambda = require("aws-cdk-lib/aws-lambda");
const defaultProps = {};
class AwsBatchAnalysisConstruct extends constructs_1.Construct {
    constructor(scope, name, props) {
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
                cdk.aws_s3_deployment.Source.asset("lib/assets/scripts/documentation_generation"),
            ],
            destinationBucket: s3Bucket,
            destinationKeyPrefix: "code-processing",
        });
        if (cdk.Fn.conditionEquals(props.enableResearchAgentParam.valueAsString, 'true')) {
            new cdk.aws_s3_deployment.BucketDeployment(this, "AgentBucketScript", {
                sources: [
                    cdk.aws_s3_deployment.Source.asset("lib/assets/scripts/research_agent"),
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
        s3Bucket.grantReadWrite(jobExecutionRole);
        const jobDefinition = new batch.EcsJobDefinition(this, 'QBusinessJob', {
            container: new batch.EcsFargateContainerDefinition(this, 'Container', {
                image: ecs.ContainerImage.fromRegistry('public.ecr.aws/ubuntu/ubuntu:24.10'),
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
                `arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-opus-20240229-v1:0`,
                `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/anthropic.claude-3-haiku-20240229-v1:1`,
                `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`,
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
            ]
        }));
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
        const submitBatchAnalysisJob = new lambda.Function(this, 'QBusinesssubmitBatchAnalysisJob', {
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
            // Bucket for agent knowledge data lake
            const agentKnowledgeBucket = new cdk.aws_s3.Bucket(this, 'AgentKnowledgeBucket', {
                removalPolicy: cdk.RemovalPolicy.DESTROY,
                autoDeleteObjects: true,
                blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
                encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
                enforceSSL: true,
            });
            const initialGoal = `Clone the <repo/> and document everything about it in the reasoning graph and Amazon Q.
    Amazon Q should be populated as much as possible so that someone can immediately start working on it by searching the Amazon Q conversationally.
    Some topics that should definitely be explored are:
    - What is the purpose of the repository?
    - What are the main components of the repository?
    - How does the data flow in the repository?
    <repo>${props.repository}</repo>`;
            // Add another lambda that invokes the file submit_agent_job.py
            const submitAgentJobLambda = new lambda.Function(this, 'QBusinessSubmitAgentJobLambda', {
                code: lambda.Code.fromAsset('lib/assets/lambdas/batch_lambdas'),
                handler: 'submit_agent_job.lambda_handler',
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
                    INITIAL_GOAL: initialGoal,
                    AGENT_KNOWLEDGE_BUCKET: agentKnowledgeBucket.bucketName
                },
                layers: [props.boto3Layer],
                role: submitJobRole,
                timeout: cdk.Duration.minutes(5),
                memorySize: 512,
            });
            // submitAgentJobLambda.node.addDependency(jobDefinition);
            // // Custom resource to invoke the lambda
            // const submitAgentJobLambdaProvider = new cdk.custom_resources.Provider(this, 'QBuinessSubmitAgentJobLambdaProvider', {
            //   onEventHandler: submitAgentJobLambda,
            //   logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
            // });
            // new cdk.CustomResource(this, 'QBusinessSubmitAgentJobLambdaCustomResource', {
            //   serviceToken: submitAgentJobLambdaProvider.serviceToken,
            // });
            // Add API Gateway that invokes Lambda to submit agent job
            const agentApi = new cdk.aws_apigateway.RestApi(this, 'QBusinessAgentApi', {
                restApiName: 'QBusinessAgentApi',
                description: 'API Gateway for submitting agent job',
            });
            const auth = new cdk.aws_apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
                cognitoUserPools: [props.userPool],
            });
            // Define a request validator
            const requestValidator = new cdk.aws_apigateway.RequestValidator(this, 'RequestValidator', {
                restApi: agentApi,
                validateRequestBody: true
            });
            // Create a resource and method
            const agentResource = agentApi.root.addResource('agent-goal');
            const agentIntegration = new cdk.aws_apigateway.LambdaIntegration(submitAgentJobLambda);
            const writeScope = 'repository/write';
            agentResource.addMethod('POST', agentIntegration, {
                authorizer: auth,
                authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
                authorizationScopes: [writeScope],
                requestParameters: {
                    'method.request.header.Authorization': true
                },
                methodResponses: [
                    {
                        statusCode: '200',
                        responseModels: {
                            'application/json': cdk.aws_apigateway.Model.EMPTY_MODEL,
                        },
                    },
                ],
            });
            // Grant the API Gateway permission to invoke the Lambda function
            submitAgentJobLambda.grantInvoke(new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'));
            // Create a Lambda function to generate and upload the OpenAPI schema
            const schemaGeneratorFunction = new lambda.Function(this, 'SchemaGeneratorFunction', {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: 'index.handler',
                code: lambda.Code.fromAsset('lib/assets/lambdas/schema_generator'),
                environment: {
                    BUCKET_NAME: s3Bucket.bucketName,
                    API_ID: agentApi.restApiId,
                    STAGE_NAME: agentApi.deploymentStage.stageName,
                    AUTH_URL: props.cognitoDomain + '/oauth2/authorize',
                    TOKEN_URL: props.cognitoDomain + '/oauth2/token',
                    SECRET_ROLE_ARN: props.cognitoSecretAccessRole.roleArn,
                    SECRET_ARN: props.cognitoSecret.secretArn,
                    APP_ID: props.qAppId,
                },
            });
            // Grant the Lambda function permission to write to the S3 bucket
            s3Bucket.grantReadWrite(schemaGeneratorFunction);
            // Grant the Lambda function permission to write to agent knowledge bucket
            agentKnowledgeBucket.grantWrite(schemaGeneratorFunction);
            agentKnowledgeBucket.grantReadWrite(jobExecutionRole);
            // Grant it access to pass cognitoSecretAccessRole
            schemaGeneratorFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
                actions: ['iam:PassRole'],
                resources: [props.cognitoSecretAccessRole.roleArn],
            }));
            // Grant the Lambda function permission to describe API Gateway
            schemaGeneratorFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
                actions: ['apigateway:GET'],
                resources: ['*'],
            }));
            // Grant the Lambda function permission to qbusiness:CreatePlugin on application
            schemaGeneratorFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
                actions: ['qbusiness:CreatePlugin'],
                resources: ['*'],
            }));
            // Create a custom resource to trigger the Lambda function after API Gateway creation
            const schemaGeneratorProvider = new cdk.custom_resources.Provider(this, 'SchemaGeneratorProvider', {
                onEventHandler: schemaGeneratorFunction,
            });
            new cdk.CustomResource(this, 'SchemaGeneratorTrigger', {
                serviceToken: schemaGeneratorProvider.serviceToken,
                properties: {
                    ApiId: agentApi.restApiId,
                },
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
exports.AwsBatchAnalysisConstruct = AwsBatchAnalysisConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzLWJhdGNoLWFuYWx5c2lzLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF3cy1iYXRjaC1hbmFseXNpcy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLDJDQUF1QztBQUN2QywrQ0FBK0M7QUFDL0MsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUMzQyxpREFBaUQ7QUF3QmpELE1BQU0sWUFBWSxHQUFtQyxFQUFFLENBQUM7QUFFeEQsTUFBYSx5QkFBMEIsU0FBUSxzQkFBUztJQUVwRCxZQUFZLEtBQWdCLEVBQUUsSUFBWSxFQUFFLEtBQTRCO1FBQ3RFLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFbkIsS0FBSyxHQUFHLEVBQUUsR0FBRyxZQUFZLEVBQUUsR0FBRyxLQUFLLEVBQUUsQ0FBQztRQUV0QyxNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUM7UUFFaEQsd0JBQXdCO1FBQ3hCLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ25FLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDeEMsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixpQkFBaUIsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDekQsVUFBVSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUNsRCxVQUFVLEVBQUUsSUFBSTtTQUNqQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUU7WUFDN0UsT0FBTyxFQUFFO2dCQUNQLEdBQUcsQ0FBQyxpQkFBaUIsQ0FB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QVUsRUFBRTtvQkFDVixLQUFLLEVBQUUsUUFBUSxDQUFDLFNBQVM7aUJBQzFCO2FBQ0YsQ0FBQyxDQUFDO1NBRUo7UUFFRCxtQkFBbUI7UUFDbkIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDbEMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxXQUFXO1NBQzVCLENBQUMsQ0FBQztRQUVILDRCQUE0QjtRQUM1QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxPQUFPO1NBQ2hDLENBQUMsQ0FBQztJQUVMLENBQUM7Q0FDSjtBQXhZRCw4REF3WUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XHJcbmltcG9ydCAqIGFzIGJhdGNoIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYmF0Y2hcIjtcclxuaW1wb3J0ICogYXMgZWNzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWNzXCI7XHJcbmltcG9ydCAqIGFzIGVjMiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVjMlwiO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcclxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXdzQmF0Y2hBbmFseXNpc1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIHJlYWRvbmx5IHFBcHBOYW1lOiBzdHJpbmc7XHJcbiAgcmVhZG9ubHkgcUFwcElkOiBzdHJpbmc7XHJcbiAgcmVhZG9ubHkgcUFwcEluZGV4SWQ6IHN0cmluZ1xyXG4gIHJlYWRvbmx5IHFBcHBEYXRhU291cmNlSWQ6IHN0cmluZztcclxuICByZWFkb25seSBxQXBwUm9sZUFybjogc3RyaW5nO1xyXG4gIHJlYWRvbmx5IHJlcG9zaXRvcnk6IHN0cmluZztcclxuICByZWFkb25seSBib3RvM0xheWVyOiBsYW1iZGEuTGF5ZXJWZXJzaW9uO1xyXG4gIHJlYWRvbmx5IHNzaFVybDogc3RyaW5nO1xyXG4gIHJlYWRvbmx5IHNzaEtleU5hbWU6IHN0cmluZztcclxuICByZWFkb25seSBuZXB0dW5lR3JhcGhJZDogc3RyaW5nO1xyXG4gIHJlYWRvbmx5IGVuYWJsZUdyYXBoUGFyYW06IGNkay5DZm5QYXJhbWV0ZXI7XHJcbiAgcmVhZG9ubHkgZW5hYmxlUmVzZWFyY2hBZ2VudFBhcmFtOiBjZGsuQ2ZuUGFyYW1ldGVyO1xyXG4gIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xyXG4gIHJlYWRvbmx5IGNvZ25pdG9Eb21haW46IHN0cmluZztcclxuICByZWFkb25seSBjb2duaXRvU2VjcmV0QWNjZXNzUm9sZTogaWFtLlJvbGU7XHJcbiAgcmVhZG9ubHkgY29nbml0b1NlY3JldDogc2VjcmV0c21hbmFnZXIuU2VjcmV0O1xyXG59XHJcblxyXG5jb25zdCBkZWZhdWx0UHJvcHM6IFBhcnRpYWw8QXdzQmF0Y2hBbmFseXNpc1Byb3BzPiA9IHt9O1xyXG5cclxuZXhwb3J0IGNsYXNzIEF3c0JhdGNoQW5hbHlzaXNDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIG5hbWU6IHN0cmluZywgcHJvcHM6IEF3c0JhdGNoQW5hbHlzaXNQcm9wcykge1xyXG4gICAgICBzdXBlcihzY29wZSwgbmFtZSk7XHJcblxyXG4gICAgICBwcm9wcyA9IHsgLi4uZGVmYXVsdFByb3BzLCAuLi5wcm9wcyB9O1xyXG5cclxuICAgICAgY29uc3QgYXdzQWNjb3VudElkID0gY2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnQ7XHJcblxyXG4gICAgICAvLyBVcGxvYWQgdGhlIGNvZGUgdG8gUzNcclxuICAgICAgY29uc3QgczNCdWNrZXQgPSBuZXcgY2RrLmF3c19zMy5CdWNrZXQodGhpcywgJ0NvZGVQcm9jZXNzaW5nQnVja2V0Jywge1xyXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IGNkay5hd3NfczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICAgIGVuY3J5cHRpb246IGNkay5hd3NfczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxyXG4gICAgICAgIGVuZm9yY2VTU0w6IHRydWUsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgbmV3IGNkay5hd3NfczNfZGVwbG95bWVudC5CdWNrZXREZXBsb3ltZW50KHRoaXMsIFwiQ29kZVByb2Nlc3NpbmdCdWNrZXRTY3JpcHRcIiwge1xyXG4gICAgICAgIHNvdXJjZXM6IFtcclxuICAgICAgICAgIGNkay5hd3NfczNfZGVwbG95bWVudC5Tb3VyY2UuYXNzZXQoXHJcbiAgICAgICAgICAgICAgXCJsaWIvYXNzZXRzL3NjcmlwdHMvZG9jdW1lbnRhdGlvbl9nZW5lcmF0aW9uXCJcclxuICAgICAgICAgICksXHJcbiAgICAgICAgXSxcclxuICAgICAgICBkZXN0aW5hdGlvbkJ1Y2tldDogczNCdWNrZXQsXHJcbiAgICAgICAgZGVzdGluYXRpb25LZXlQcmVmaXg6IFwiY29kZS1wcm9jZXNzaW5nXCIsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKGNkay5Gbi5jb25kaXRpb25FcXVhbHMocHJvcHMuZW5hYmxlUmVzZWFyY2hBZ2VudFBhcmFtLnZhbHVlQXNTdHJpbmcsICd0cnVlJykpIHtcclxuICAgICAgICBuZXcgY2RrLmF3c19zM19kZXBsb3ltZW50LkJ1Y2tldERlcGxveW1lbnQodGhpcywgXCJBZ2VudEJ1Y2tldFNjcmlwdFwiLCB7XHJcbiAgICAgICAgICBzb3VyY2VzOiBbXHJcbiAgICAgICAgICAgIGNkay5hd3NfczNfZGVwbG95bWVudC5Tb3VyY2UuYXNzZXQoXHJcbiAgICAgICAgICAgICAgICBcImxpYi9hc3NldHMvc2NyaXB0cy9yZXNlYXJjaF9hZ2VudFwiXHJcbiAgICAgICAgICAgICksXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IHMzQnVja2V0LFxyXG4gICAgICAgICAgZGVzdGluYXRpb25LZXlQcmVmaXg6IFwicmVzZWFyY2gtYWdlbnRcIixcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdnBjID0gbmV3IGVjMi5WcGModGhpcywgJ1ZwYycsIHtcclxuICAgICAgICBtYXhBenM6IDIsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc3QgY29tcHV0ZUVudmlyb25tZW50ID0gbmV3IGJhdGNoLkZhcmdhdGVDb21wdXRlRW52aXJvbm1lbnQodGhpcywgJ1FTY3JpcHRDb21wdXRlRW52Jywge1xyXG4gICAgICAgIHZwYyxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjb25zdCBqb2JRdWV1ZSA9IG5ldyBiYXRjaC5Kb2JRdWV1ZSh0aGlzLCAnUVByb2Nlc3NpbmdKb2JRdWV1ZScsIHtcclxuICAgICAgICBwcmlvcml0eTogMSxcclxuICAgICAgICBjb21wdXRlRW52aXJvbm1lbnRzOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGNvbXB1dGVFbnZpcm9ubWVudCxcclxuICAgICAgICAgICAgb3JkZXI6IDEsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc3Qgam9iRXhlY3V0aW9uUm9sZSA9IG5ldyBjZGsuYXdzX2lhbS5Sb2xlKHRoaXMsICdRUHJvY2Vzc2luZ0pvYkV4ZWN1dGlvblJvbGUnLCB7XHJcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgY2RrLmF3c19pYW0uU2VydmljZVByaW5jaXBhbCgnZWNzLXRhc2tzLmFtYXpvbmF3cy5jb20nKSxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBqb2JFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgIFwicWJ1c2luZXNzOkNoYXRTeW5jXCIsXHJcbiAgICAgICAgICBcInFidXNpbmVzczpCYXRjaFB1dERvY3VtZW50XCIsXHJcbiAgICAgICAgICBcInFidXNpbmVzczpCYXRjaERlbGV0ZURvY3VtZW50XCIsXHJcbiAgICAgICAgICBcInFidXNpbmVzczpTdGFydERhdGFTb3VyY2VTeW5jSm9iXCIsXHJcbiAgICAgICAgICBcInFidXNpbmVzczpTdG9wRGF0YVNvdXJjZVN5bmNKb2JcIixcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgICAgYGFybjphd3M6cWJ1c2luZXNzOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHthd3NBY2NvdW50SWR9OmFwcGxpY2F0aW9uLypgLFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0pKTtcclxuICAgICAgLy8gR3JhbnQgSm9iIEV4ZWN1dGlvbiBSb2xlIGFjY2VzcyB0byBsb2dnaW5nXHJcbiAgICAgIGpvYkV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGNkay5hd3NfaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgXCJsb2dzOkNyZWF0ZUxvZ0dyb3VwXCIsXHJcbiAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nU3RyZWFtXCIsXHJcbiAgICAgICAgICBcImxvZ3M6UHV0TG9nRXZlbnRzXCIsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICAgIGBhcm46YXdzOmxvZ3M6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2F3c0FjY291bnRJZH06bG9nLWdyb3VwOi9hd3MvYmF0Y2gvKmAsXHJcbiAgICAgICAgXSxcclxuICAgICAgfSkpO1xyXG5cclxuICAgICAgLy8gQWxsb3cgcGFzcyByb2xlXHJcbiAgICAgIGpvYkV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGNkay5hd3NfaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgXCJpYW06UGFzc1JvbGVcIixcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogW3Byb3BzLnFBcHBSb2xlQXJuXSxcclxuICAgICAgfSkpO1xyXG5cclxuICAgICAgczNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoam9iRXhlY3V0aW9uUm9sZSk7XHJcblxyXG4gICAgICBjb25zdCBqb2JEZWZpbml0aW9uID0gbmV3IGJhdGNoLkVjc0pvYkRlZmluaXRpb24odGhpcywgJ1FCdXNpbmVzc0pvYicsIHtcclxuICAgICAgICBjb250YWluZXI6IG5ldyBiYXRjaC5FY3NGYXJnYXRlQ29udGFpbmVyRGVmaW5pdGlvbih0aGlzLCAnQ29udGFpbmVyJywge1xyXG4gICAgICAgICAgaW1hZ2U6IGVjcy5Db250YWluZXJJbWFnZS5mcm9tUmVnaXN0cnkoJ3B1YmxpYy5lY3IuYXdzL3VidW50dS91YnVudHU6MjQuMTAnKSwgXHJcbiAgICAgICAgICBtZW1vcnk6IGNkay5TaXplLmdpYmlieXRlcygyKSxcclxuICAgICAgICAgIGNwdTogMSxcclxuICAgICAgICAgIGV4ZWN1dGlvblJvbGU6IGpvYkV4ZWN1dGlvblJvbGUsXHJcbiAgICAgICAgICBqb2JSb2xlOiBqb2JFeGVjdXRpb25Sb2xlLFxyXG4gICAgICAgICAgZXBoZW1lcmFsU3RvcmFnZVNpemU6IGNkay5TaXplLmdpYmlieXRlcygyMSksXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gR3JhbnQgSm9iIEV4ZWN1dGlvbiBSb2xlIHRvIHJlYWQgZnJvbSBTZWNyZXRzIG1hbmFnZXIgaWYgc3NoIGtleSBpcyBwcm92aWRlZFxyXG4gICAgICBqb2JFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWVcIixcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgICAgYGFybjphd3M6c2VjcmV0c21hbmFnZXI6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2F3c0FjY291bnRJZH06c2VjcmV0OiR7cHJvcHMuc3NoS2V5TmFtZX0tPz8/Pz8/YFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0pKTtcclxuXHJcbiAgICAgIC8vIEJlZHJvY2sgQ2xhdWRlIDMgc29ubmV0IHBlcm1pc3Npb25cclxuICAgICAgam9iRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MWAsXHJcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowYCxcclxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6dXMtd2VzdC0yOjpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy1vcHVzLTIwMjQwMjI5LXYxOjBgLFxyXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy1oYWlrdS0yMDI0MDIyOS12MToxYCxcclxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtNS1zb25uZXQtMjAyNDA2MjAtdjE6MGAsXHJcbiAgICAgICAgXVxyXG4gICAgICB9KSk7XHJcblxyXG4gICAgICAvLyBBZGQgZ3JhcGggcGVybWlzc2lvbnNcclxuICAgICAgam9iRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICBcIm5lcHR1bmUtZ3JhcGg6RGVsZXRlRGF0YVZpYVF1ZXJ5XCIsIFxyXG4gICAgICAgICAgXCJuZXB0dW5lLWdyYXBoOlJlYWREYXRhVmlhUXVlcnlcIiwgXHJcbiAgICAgICAgICBcIm5lcHR1bmUtZ3JhcGg6V3JpdGVEYXRhVmlhUXVlcnlcIlxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgICBgYXJuOmF3czpuZXB0dW5lLWdyYXBoOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHthd3NBY2NvdW50SWR9OmdyYXBoLyR7cHJvcHMubmVwdHVuZUdyYXBoSWR9YCxcclxuICAgICAgICBdfSlcclxuICAgICAgKTtcclxuXHJcblxyXG4gICAgICAvLyBSb2xlIHRvIHN1Ym1pdCBqb2JcclxuICAgICAgY29uc3Qgc3VibWl0Sm9iUm9sZSA9IG5ldyBjZGsuYXdzX2lhbS5Sb2xlKHRoaXMsICdRQnVzaW5lc3NTdWJtaXRKb2JSb2xlJywge1xyXG4gICAgICAgIGFzc3VtZWRCeTogbmV3IGNkay5hd3NfaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgc3VibWl0Sm9iUm9sZS5hZGRUb1BvbGljeShuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICBcInFidXNpbmVzczpMaXN0QXBwbGljYXRpb25zXCIsXHJcbiAgICAgICAgICBcInFidXNpbmVzczpMaXN0SW5kaWNlc1wiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgICBgKmAsXHJcbiAgICAgICAgXSxcclxuICAgICAgfSkpO1xyXG5cclxuICAgICAgc3VibWl0Sm9iUm9sZS5hZGRUb1BvbGljeShuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICBcImlhbTpQYXNzUm9sZVwiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbam9iRXhlY3V0aW9uUm9sZS5yb2xlQXJuXSxcclxuICAgICAgfSkpO1xyXG5cclxuICAgICAgLy8gU3VibWl0IEpvYiBSb2xlIENsb3VkV2F0Y2ggTG9nc1xyXG4gICAgICBzdWJtaXRKb2JSb2xlLmFkZFRvUG9saWN5KG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgIFwibG9nczpDcmVhdGVMb2dHcm91cFwiLFxyXG4gICAgICAgICAgXCJsb2dzOkNyZWF0ZUxvZ1N0cmVhbVwiLFxyXG4gICAgICAgICAgXCJsb2dzOlB1dExvZ0V2ZW50c1wiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgICBgYXJuOmF3czpsb2dzOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHthd3NBY2NvdW50SWR9OmxvZy1ncm91cDovYXdzL2xhbWJkYS8qYCxcclxuICAgICAgICBdLFxyXG4gICAgICB9KSk7XHJcblxyXG4gICAgICAvLyBMYW1iZGEgdG8gc3VibWl0IGpvYlxyXG4gICAgICBjb25zdCBzdWJtaXRCYXRjaEFuYWx5c2lzSm9iICA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1FCdXNpbmVzc3N1Ym1pdEJhdGNoQW5hbHlzaXNKb2InLCB7XHJcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsaWIvYXNzZXRzL2xhbWJkYXMvYmF0Y2hfbGFtYmRhcycpLFxyXG4gICAgICAgIGhhbmRsZXI6ICdzdWJtaXRfYmF0Y2hfam9iLm9uX2V2ZW50JyxcclxuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcclxuICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgQkFUQ0hfSk9CX0RFRklOSVRJT046IGpvYkRlZmluaXRpb24uam9iRGVmaW5pdGlvbkFybixcclxuICAgICAgICAgIEJBVENIX0pPQl9RVUVVRTogam9iUXVldWUuam9iUXVldWVBcm4sXHJcbiAgICAgICAgICBSRVBPX1VSTDogcHJvcHMucmVwb3NpdG9yeSxcclxuICAgICAgICAgIEFNQVpPTl9RX0FQUF9JRDogcHJvcHMucUFwcElkLFxyXG4gICAgICAgICAgUV9BUFBfTkFNRTogcHJvcHMucUFwcE5hbWUsXHJcbiAgICAgICAgICBRX0FQUF9EQVRBX1NPVVJDRV9JRDogcHJvcHMucUFwcERhdGFTb3VyY2VJZCxcclxuICAgICAgICAgIFFfQVBQX0lOREVYOiBwcm9wcy5xQXBwSW5kZXhJZCxcclxuICAgICAgICAgIFFfQVBQX1JPTEVfQVJOOiBwcm9wcy5xQXBwUm9sZUFybixcclxuICAgICAgICAgIFMzX0JVQ0tFVDogczNCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgICAgIFNTSF9VUkw6IHByb3BzLnNzaFVybCxcclxuICAgICAgICAgIFNTSF9LRVlfTkFNRTogcHJvcHMuc3NoS2V5TmFtZSxcclxuICAgICAgICAgIEVOQUJMRV9HUkFQSDogcHJvcHMuZW5hYmxlR3JhcGhQYXJhbS52YWx1ZUFzU3RyaW5nLFxyXG4gICAgICAgICAgTkVQVFVORV9HUkFQSF9JRDogcHJvcHMubmVwdHVuZUdyYXBoSWQsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBsYXllcnM6IFtwcm9wcy5ib3RvM0xheWVyXSxcclxuICAgICAgICByb2xlOiBzdWJtaXRKb2JSb2xlLFxyXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBzdWJtaXRCYXRjaEFuYWx5c2lzSm9iLm5vZGUuYWRkRGVwZW5kZW5jeShqb2JEZWZpbml0aW9uKTtcclxuXHJcbiAgICAgIGpvYkRlZmluaXRpb24uZ3JhbnRTdWJtaXRKb2Ioc3VibWl0Sm9iUm9sZSwgam9iUXVldWUpO1xyXG5cclxuICAgICAgLy8gQ3VzdG9tIHJlc291cmNlIHRvIGludm9rZSB0aGUgbGFtYmRhXHJcbiAgICAgIGNvbnN0IHN1Ym1pdEJhdGNoQW5hbHlzaXNKb2JQcm92aWRlciA9IG5ldyBjZGsuY3VzdG9tX3Jlc291cmNlcy5Qcm92aWRlcih0aGlzLCAnUUJ1aW5lc3NzdWJtaXRCYXRjaEFuYWx5c2lzSm9iUHJvdmlkZXInLCB7XHJcbiAgICAgICAgb25FdmVudEhhbmRsZXI6IHN1Ym1pdEJhdGNoQW5hbHlzaXNKb2IsXHJcbiAgICAgICAgbG9nUmV0ZW50aW9uOiBjZGsuYXdzX2xvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIG5ldyBjZGsuQ3VzdG9tUmVzb3VyY2UodGhpcywgJ1FCdXNpbmVzc3N1Ym1pdEJhdGNoQW5hbHlzaXNKb2JDdXN0b21SZXNvdXJjZScsIHtcclxuICAgICAgICBzZXJ2aWNlVG9rZW46IHN1Ym1pdEJhdGNoQW5hbHlzaXNKb2JQcm92aWRlci5zZXJ2aWNlVG9rZW4sXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKGNkay5Gbi5jb25kaXRpb25FcXVhbHMocHJvcHMuZW5hYmxlUmVzZWFyY2hBZ2VudFBhcmFtLnZhbHVlQXNTdHJpbmcsICd0cnVlJykpIHtcclxuXHJcbiAgICAgICAgLy8gQnVja2V0IGZvciBhZ2VudCBrbm93bGVkZ2UgZGF0YSBsYWtlXHJcbiAgICAgICAgY29uc3QgYWdlbnRLbm93bGVkZ2VCdWNrZXQgPSBuZXcgY2RrLmF3c19zMy5CdWNrZXQodGhpcywgJ0FnZW50S25vd2xlZGdlQnVja2V0Jywge1xyXG4gICAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxyXG4gICAgICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IGNkay5hd3NfczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICAgICAgZW5jcnlwdGlvbjogY2RrLmF3c19zMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXHJcbiAgICAgICAgICBlbmZvcmNlU1NMOiB0cnVlLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBpbml0aWFsR29hbCA9IGBDbG9uZSB0aGUgPHJlcG8vPiBhbmQgZG9jdW1lbnQgZXZlcnl0aGluZyBhYm91dCBpdCBpbiB0aGUgcmVhc29uaW5nIGdyYXBoIGFuZCBBbWF6b24gUS5cclxuICAgIEFtYXpvbiBRIHNob3VsZCBiZSBwb3B1bGF0ZWQgYXMgbXVjaCBhcyBwb3NzaWJsZSBzbyB0aGF0IHNvbWVvbmUgY2FuIGltbWVkaWF0ZWx5IHN0YXJ0IHdvcmtpbmcgb24gaXQgYnkgc2VhcmNoaW5nIHRoZSBBbWF6b24gUSBjb252ZXJzYXRpb25hbGx5LlxyXG4gICAgU29tZSB0b3BpY3MgdGhhdCBzaG91bGQgZGVmaW5pdGVseSBiZSBleHBsb3JlZCBhcmU6XHJcbiAgICAtIFdoYXQgaXMgdGhlIHB1cnBvc2Ugb2YgdGhlIHJlcG9zaXRvcnk/XHJcbiAgICAtIFdoYXQgYXJlIHRoZSBtYWluIGNvbXBvbmVudHMgb2YgdGhlIHJlcG9zaXRvcnk/XHJcbiAgICAtIEhvdyBkb2VzIHRoZSBkYXRhIGZsb3cgaW4gdGhlIHJlcG9zaXRvcnk/XHJcbiAgICA8cmVwbz4ke3Byb3BzLnJlcG9zaXRvcnl9PC9yZXBvPmBcclxuXHJcbiAgICAgICAgLy8gQWRkIGFub3RoZXIgbGFtYmRhIHRoYXQgaW52b2tlcyB0aGUgZmlsZSBzdWJtaXRfYWdlbnRfam9iLnB5XHJcbiAgICAgICAgY29uc3Qgc3VibWl0QWdlbnRKb2JMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdRQnVzaW5lc3NTdWJtaXRBZ2VudEpvYkxhbWJkYScsIHtcclxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGliL2Fzc2V0cy9sYW1iZGFzL2JhdGNoX2xhbWJkYXMnKSxcclxuICAgICAgICAgIGhhbmRsZXI6ICdzdWJtaXRfYWdlbnRfam9iLmxhbWJkYV9oYW5kbGVyJyxcclxuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEyLFxyXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgQkFUQ0hfSk9CX0RFRklOSVRJT046IGpvYkRlZmluaXRpb24uam9iRGVmaW5pdGlvbkFybixcclxuICAgICAgICAgICAgQkFUQ0hfSk9CX1FVRVVFOiBqb2JRdWV1ZS5qb2JRdWV1ZUFybixcclxuICAgICAgICAgICAgUkVQT19VUkw6IHByb3BzLnJlcG9zaXRvcnksXHJcbiAgICAgICAgICAgIEFNQVpPTl9RX0FQUF9JRDogcHJvcHMucUFwcElkLFxyXG4gICAgICAgICAgICBRX0FQUF9OQU1FOiBwcm9wcy5xQXBwTmFtZSxcclxuICAgICAgICAgICAgUV9BUFBfREFUQV9TT1VSQ0VfSUQ6IHByb3BzLnFBcHBEYXRhU291cmNlSWQsXHJcbiAgICAgICAgICAgIFFfQVBQX0lOREVYOiBwcm9wcy5xQXBwSW5kZXhJZCxcclxuICAgICAgICAgICAgUV9BUFBfUk9MRV9BUk46IHByb3BzLnFBcHBSb2xlQXJuLFxyXG4gICAgICAgICAgICBTM19CVUNLRVQ6IHMzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgICAgIFNTSF9VUkw6IHByb3BzLnNzaFVybCxcclxuICAgICAgICAgICAgU1NIX0tFWV9OQU1FOiBwcm9wcy5zc2hLZXlOYW1lLFxyXG4gICAgICAgICAgICBFTkFCTEVfR1JBUEg6IHByb3BzLmVuYWJsZUdyYXBoUGFyYW0udmFsdWVBc1N0cmluZyxcclxuICAgICAgICAgICAgTkVQVFVORV9HUkFQSF9JRDogcHJvcHMubmVwdHVuZUdyYXBoSWQsXHJcbiAgICAgICAgICAgIElOSVRJQUxfR09BTDogaW5pdGlhbEdvYWwsXHJcbiAgICAgICAgICAgIEFHRU5UX0tOT1dMRURHRV9CVUNLRVQ6IGFnZW50S25vd2xlZGdlQnVja2V0LmJ1Y2tldE5hbWVcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBsYXllcnM6IFtwcm9wcy5ib3RvM0xheWVyXSxcclxuICAgICAgICAgIHJvbGU6IHN1Ym1pdEpvYlJvbGUsXHJcbiAgICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgICAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gc3VibWl0QWdlbnRKb2JMYW1iZGEubm9kZS5hZGREZXBlbmRlbmN5KGpvYkRlZmluaXRpb24pO1xyXG5cclxuICAgICAgICAvLyAvLyBDdXN0b20gcmVzb3VyY2UgdG8gaW52b2tlIHRoZSBsYW1iZGFcclxuICAgICAgICAvLyBjb25zdCBzdWJtaXRBZ2VudEpvYkxhbWJkYVByb3ZpZGVyID0gbmV3IGNkay5jdXN0b21fcmVzb3VyY2VzLlByb3ZpZGVyKHRoaXMsICdRQnVpbmVzc1N1Ym1pdEFnZW50Sm9iTGFtYmRhUHJvdmlkZXInLCB7XHJcbiAgICAgICAgLy8gICBvbkV2ZW50SGFuZGxlcjogc3VibWl0QWdlbnRKb2JMYW1iZGEsXHJcbiAgICAgICAgLy8gICBsb2dSZXRlbnRpb246IGNkay5hd3NfbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksXHJcbiAgICAgICAgLy8gfSk7XHJcblxyXG4gICAgICAgIC8vIG5ldyBjZGsuQ3VzdG9tUmVzb3VyY2UodGhpcywgJ1FCdXNpbmVzc1N1Ym1pdEFnZW50Sm9iTGFtYmRhQ3VzdG9tUmVzb3VyY2UnLCB7XHJcbiAgICAgICAgLy8gICBzZXJ2aWNlVG9rZW46IHN1Ym1pdEFnZW50Sm9iTGFtYmRhUHJvdmlkZXIuc2VydmljZVRva2VuLFxyXG4gICAgICAgIC8vIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgQVBJIEdhdGV3YXkgdGhhdCBpbnZva2VzIExhbWJkYSB0byBzdWJtaXQgYWdlbnQgam9iXHJcbiAgICAgICAgY29uc3QgYWdlbnRBcGkgPSBuZXcgY2RrLmF3c19hcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1FCdXNpbmVzc0FnZW50QXBpJywge1xyXG4gICAgICAgICAgcmVzdEFwaU5hbWU6ICdRQnVzaW5lc3NBZ2VudEFwaScsXHJcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGZvciBzdWJtaXR0aW5nIGFnZW50IGpvYicsXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGF1dGggPSBuZXcgY2RrLmF3c19hcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcclxuICAgICAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFtwcm9wcy51c2VyUG9vbF0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIERlZmluZSBhIHJlcXVlc3QgdmFsaWRhdG9yXHJcbiAgICAgICAgY29uc3QgcmVxdWVzdFZhbGlkYXRvciA9IG5ldyBjZGsuYXdzX2FwaWdhdGV3YXkuUmVxdWVzdFZhbGlkYXRvcih0aGlzLCAnUmVxdWVzdFZhbGlkYXRvcicsIHtcclxuICAgICAgICAgIHJlc3RBcGk6IGFnZW50QXBpLFxyXG4gICAgICAgICAgdmFsaWRhdGVSZXF1ZXN0Qm9keTogdHJ1ZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgYSByZXNvdXJjZSBhbmQgbWV0aG9kXHJcbiAgICAgICAgY29uc3QgYWdlbnRSZXNvdXJjZSA9IGFnZW50QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2FnZW50LWdvYWwnKTtcclxuICAgICAgICBjb25zdCBhZ2VudEludGVncmF0aW9uID0gbmV3IGNkay5hd3NfYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXRBZ2VudEpvYkxhbWJkYSk7XHJcblxyXG4gICAgICAgIGNvbnN0IHdyaXRlU2NvcGUgPSAncmVwb3NpdG9yeS93cml0ZSc7XHJcblxyXG4gICAgICAgIGFnZW50UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgYWdlbnRJbnRlZ3JhdGlvbiwge1xyXG4gICAgICAgICAgYXV0aG9yaXplcjogYXV0aCxcclxuICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBjZGsuYXdzX2FwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgICAgICAgIGF1dGhvcml6YXRpb25TY29wZXM6IFt3cml0ZVNjb3BlXSxcclxuICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uJzogdHJ1ZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICAgICAgICByZXNwb25zZU1vZGVsczoge1xyXG4gICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBjZGsuYXdzX2FwaWdhdGV3YXkuTW9kZWwuRU1QVFlfTU9ERUwsXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEdyYW50IHRoZSBBUEkgR2F0ZXdheSBwZXJtaXNzaW9uIHRvIGludm9rZSB0aGUgTGFtYmRhIGZ1bmN0aW9uXHJcbiAgICAgICAgc3VibWl0QWdlbnRKb2JMYW1iZGEuZ3JhbnRJbnZva2UobmV3IGNkay5hd3NfaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2FwaWdhdGV3YXkuYW1hem9uYXdzLmNvbScpKTtcclxuXHJcbiAgICAgICAgLy8gQ3JlYXRlIGEgTGFtYmRhIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGFuZCB1cGxvYWQgdGhlIE9wZW5BUEkgc2NoZW1hXHJcbiAgICAgICAgY29uc3Qgc2NoZW1hR2VuZXJhdG9yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTY2hlbWFHZW5lcmF0b3JGdW5jdGlvbicsIHtcclxuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsaWIvYXNzZXRzL2xhbWJkYXMvc2NoZW1hX2dlbmVyYXRvcicpLFxyXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgQlVDS0VUX05BTUU6IHMzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgICAgIEFQSV9JRDogYWdlbnRBcGkucmVzdEFwaUlkLFxyXG4gICAgICAgICAgICBTVEFHRV9OQU1FOiBhZ2VudEFwaS5kZXBsb3ltZW50U3RhZ2Uuc3RhZ2VOYW1lLFxyXG4gICAgICAgICAgICBBVVRIX1VSTDogcHJvcHMuY29nbml0b0RvbWFpbiArICcvb2F1dGgyL2F1dGhvcml6ZScsXHJcbiAgICAgICAgICAgIFRPS0VOX1VSTDogcHJvcHMuY29nbml0b0RvbWFpbiArICcvb2F1dGgyL3Rva2VuJyxcclxuICAgICAgICAgICAgU0VDUkVUX1JPTEVfQVJOOiBwcm9wcy5jb2duaXRvU2VjcmV0QWNjZXNzUm9sZS5yb2xlQXJuLFxyXG4gICAgICAgICAgICBTRUNSRVRfQVJOOiBwcm9wcy5jb2duaXRvU2VjcmV0LnNlY3JldEFybixcclxuICAgICAgICAgICAgQVBQX0lEOiBwcm9wcy5xQXBwSWQsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBHcmFudCB0aGUgTGFtYmRhIGZ1bmN0aW9uIHBlcm1pc3Npb24gdG8gd3JpdGUgdG8gdGhlIFMzIGJ1Y2tldFxyXG4gICAgICAgIHMzQnVja2V0LmdyYW50UmVhZFdyaXRlKHNjaGVtYUdlbmVyYXRvckZ1bmN0aW9uKTtcclxuXHJcbiAgICAgICAgLy8gR3JhbnQgdGhlIExhbWJkYSBmdW5jdGlvbiBwZXJtaXNzaW9uIHRvIHdyaXRlIHRvIGFnZW50IGtub3dsZWRnZSBidWNrZXRcclxuICAgICAgICBhZ2VudEtub3dsZWRnZUJ1Y2tldC5ncmFudFdyaXRlKHNjaGVtYUdlbmVyYXRvckZ1bmN0aW9uKTtcclxuICAgICAgICBhZ2VudEtub3dsZWRnZUJ1Y2tldC5ncmFudFJlYWRXcml0ZShqb2JFeGVjdXRpb25Sb2xlKTtcclxuXHJcbiAgICAgICAgLy8gR3JhbnQgaXQgYWNjZXNzIHRvIHBhc3MgY29nbml0b1NlY3JldEFjY2Vzc1JvbGVcclxuICAgICAgICBzY2hlbWFHZW5lcmF0b3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgICAgICBuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgYWN0aW9uczogWydpYW06UGFzc1JvbGUnXSxcclxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbcHJvcHMuY29nbml0b1NlY3JldEFjY2Vzc1JvbGUucm9sZUFybl0sXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIC8vIEdyYW50IHRoZSBMYW1iZGEgZnVuY3Rpb24gcGVybWlzc2lvbiB0byBkZXNjcmliZSBBUEkgR2F0ZXdheVxyXG4gICAgICAgIHNjaGVtYUdlbmVyYXRvckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgICAgIG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICBhY3Rpb25zOiBbJ2FwaWdhdGV3YXk6R0VUJ10sXHJcbiAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIC8vIEdyYW50IHRoZSBMYW1iZGEgZnVuY3Rpb24gcGVybWlzc2lvbiB0byBxYnVzaW5lc3M6Q3JlYXRlUGx1Z2luIG9uIGFwcGxpY2F0aW9uXHJcbiAgICAgICAgc2NoZW1hR2VuZXJhdG9yRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICAgICAgbmV3IGNkay5hd3NfaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgIGFjdGlvbnM6IFsncWJ1c2luZXNzOkNyZWF0ZVBsdWdpbiddLFxyXG4gICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxyXG4gICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgYSBjdXN0b20gcmVzb3VyY2UgdG8gdHJpZ2dlciB0aGUgTGFtYmRhIGZ1bmN0aW9uIGFmdGVyIEFQSSBHYXRld2F5IGNyZWF0aW9uXHJcbiAgICAgICAgY29uc3Qgc2NoZW1hR2VuZXJhdG9yUHJvdmlkZXIgPSBuZXcgY2RrLmN1c3RvbV9yZXNvdXJjZXMuUHJvdmlkZXIodGhpcywgJ1NjaGVtYUdlbmVyYXRvclByb3ZpZGVyJywge1xyXG4gICAgICAgICAgb25FdmVudEhhbmRsZXI6IHNjaGVtYUdlbmVyYXRvckZ1bmN0aW9uLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBuZXcgY2RrLkN1c3RvbVJlc291cmNlKHRoaXMsICdTY2hlbWFHZW5lcmF0b3JUcmlnZ2VyJywge1xyXG4gICAgICAgICAgc2VydmljZVRva2VuOiBzY2hlbWFHZW5lcmF0b3JQcm92aWRlci5zZXJ2aWNlVG9rZW4sXHJcbiAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgIEFwaUlkOiBhZ2VudEFwaS5yZXN0QXBpSWQsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgIFxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBPdXRwdXQgSm9iIFF1ZXVlXHJcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdKb2JRdWV1ZScsIHtcclxuICAgICAgICB2YWx1ZTogam9iUXVldWUuam9iUXVldWVBcm4sXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gT3V0cHV0IEpvYiBFeGVjdXRpb24gUm9sZVxyXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSm9iRXhlY3V0aW9uUm9sZScsIHtcclxuICAgICAgICB2YWx1ZTogam9iRXhlY3V0aW9uUm9sZS5yb2xlQXJuLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICB9XHJcbn0iXX0=