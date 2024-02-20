import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CustomQBusinessConstruct } from './constructs/custom-amazon-q-construct'
import { QIamRoleConstruct } from './constructs/q-iam-role-construct';
import { AwsBatchAnalysisConstruct } from './constructs/aws-batch-analysis-construct';



export interface QBusinessCodeAnalysisProps extends cdk.StackProps {
  readonly randomPrefix: number;
}

export class QBusinessCodeAnalysisStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: QBusinessCodeAnalysisProps) {
    super(scope, id, props);

    // Cloudformation Description
    this.templateOptions.description = '(uksb-1tupboc54) - Amazon Q Business Code Analysis stack';

    const qAppRoleName = 'QBusiness-Application-' + props?.randomPrefix;

    // Input Project name that satisfies regular expression pattern: [a-zA-Z0-9][a-zA-Z0-9_-]*
    const projectNameParam = new cdk.CfnParameter(this, 'ProjectName', {
      type: 'String',
      description: 'The project name, for example langchain-agents.',
      allowedPattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$'
    });

    const repositoryUrlParam = new cdk.CfnParameter(this, 'RepositoryUrl', {
      type: 'String',
      description: 'The Git URL of the repository to scan and ingest into Amazon Q Business. Note it should end with .git, i.e. https://github.com/aws-samples/langchain-agents.git',
      allowedPattern: '^https?://.+(\.git)$'
    });
    const qAppUserIdParam = new cdk.CfnParameter(this, 'QAppUserId', {
      type: 'String',
      description: 'The user ID of the Amazon Q Business user. At the time of writing, any value will be accepted.',
    });

    // Check if the repository url is provided
    const repositoryUrl = repositoryUrlParam.valueAsString;
    const qAppUserId = qAppUserIdParam.valueAsString;
    const projectName = projectNameParam.valueAsString;

    const qAppName = projectNameParam.valueAsString + '-' + props?.randomPrefix;

    const QIamRole = new QIamRoleConstruct(this, `QIamConstruct-${props?.randomPrefix}`, { 
      roleName: qAppRoleName 
    });

    const layer = new cdk.aws_lambda.LayerVersion(this, 'layerWithQBusiness', {
      code: cdk.aws_lambda.Code.fromAsset('lib/assets/lambda-layer/boto3v1-34-40.zip'),
      compatibleRuntimes: [cdk.aws_lambda.Runtime.PYTHON_3_12],
      description: 'Boto3 v1.34.40',
    });

    const qBusinessConstruct = new CustomQBusinessConstruct(this, 'QBusinessAppConstruct', {
      amazon_q_app_name: qAppName,
      amazon_q_app_role_arn: QIamRole.role.roleArn,
      boto3Layer: layer
    });

    qBusinessConstruct.node.addDependency(layer);
    qBusinessConstruct.node.addDependency(QIamRole);

    new cdk.CfnOutput(this, 'QBusinessAppName', {
      value: qAppName,
      description: 'Amazon Q Business Application Name',
    });

    // AWS Batch to run the code analysis
    const awsBatchConstruct = new AwsBatchAnalysisConstruct(this, 'AwsBatchConstruct', {
      qAppRoleArn: QIamRole.role.roleArn,
      qAppName: qAppName,
      repository: repositoryUrl,
      boto3Layer: layer,
      qAppUserId: qAppUserId,
    });
 
    awsBatchConstruct.node.addDependency(qBusinessConstruct);

  }
}
