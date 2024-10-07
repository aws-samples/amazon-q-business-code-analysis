import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CustomQBusinessConstruct } from './constructs/custom-amazon-q-construct'
import { QIamRoleConstruct } from './constructs/q-iam-role-construct';
import { AwsBatchAnalysisConstruct } from './constructs/aws-batch-analysis-construct';
import { AmazonNeptuneConstruct } from './constructs/amazon-neptune-construct';
import { CognitoConstruct } from './constructs/cognito-construct';
import { AmazonQPluginConstruct } from './constructs/amazon-q-plugin';

export class QBusinessCodeAnalysisStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cloudformation Description
    this.templateOptions.description = '(uksb-1tupboc55) - Amazon Q Business Code Analysis stack';

    const qAppRoleName = 'QBusiness-Application-Code-Analysis';

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

    // Optional SSH URL Param
    const sshUrlParam = new cdk.CfnParameter(this, 'SshUrl', {
      type: 'String',
      description: 'Optional. The SSH URL of the repository to scan and ingest into Amazon Q Business. Note it should end with .git, i.e. git@github.com:aws-samples/langchain-agents.git',
      default: 'None'
    });

    // Optional SSH Key Param Name
    const sshKeyNameParam = new cdk.CfnParameter(this, 'SshSecretName', {
      type: 'String',
      description: 'Optional. The name of the SSH key to use to access the repository. It should be the name of the SSH key stored in the AWS Systems Manager Parameter Store.',
      default: 'None'
    });

    const idcArnParam = new cdk.CfnParameter(this, 'IdcArn', {
      type: 'String',
      description: 'The arn of Identity Center in the same region that the Q application is going to be deployed',
      allowedPattern: '^arn:aws[a-zA-Z0-9-]*:sso:[a-z0-9-]*:[0-9]{12}:instance\/.*$|^arn:aws:sso:::instance\/.*$',
    });

    const enableGraphParam = new cdk.CfnParameter(this, 'EnableGraph', {
      type: 'String',
      description: 'Enable the Neptune Graph. Set to true to enable the graph, false to disable it.',
      allowedValues: ['true', 'false'],
      default: 'false'
    });

    const enableResearchAgentParam = new cdk.CfnParameter(this, 'EnableResearchAgent', {
      type: 'String',
      description: 'Enable the Research Agent. Set to true to enable the research agent, false to disable it.',
      allowedValues: ['true', 'false'],
      default: 'false'
    });

    // The cognito domain prefix that satisfies regular expression pattern: [a-zA-Z0-9][a-zA-Z0-9_-]*
    const cognitoDomainPrefixParam = new cdk.CfnParameter(this, 'CognitoDomainPrefix', {
      type: 'String',
      description: 'The cognito domain prefix.',
      allowedPattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$'
    });

    // Check if the repository url is provided
    const repositoryUrl = repositoryUrlParam.valueAsString;
    const projectName = projectNameParam.valueAsString;
    const sshUrl = sshUrlParam.valueAsString;
    const sshKeyName = sshKeyNameParam.valueAsString;
    const cognitoDomainPrefix = cognitoDomainPrefixParam.valueAsString;
    // Boolean evaluations

    const qAppName = projectName;
    const idcArn = idcArnParam.valueAsString;

    const qIamRole = new QIamRoleConstruct(this, `QIamConstruct`, {
      roleName: qAppRoleName
    });

    const layer = new cdk.aws_lambda.LayerVersion(this, 'layerWithQBusiness', {
      code: cdk.aws_lambda.Code.fromAsset('lib/assets/lambda-layer/boto3_v1.34.109_py3.12.zip'),
      compatibleRuntimes: [cdk.aws_lambda.Runtime.PYTHON_3_12],
      description: 'Boto3 v1.34.109',
    });

    const qBusinessConstruct = new CustomQBusinessConstruct(this, 'QBusinessAppConstruct', {
      amazon_q_app_name: qAppName,
      amazon_q_app_role_arn: qIamRole.app_role.roleArn,
      amazon_q_web_exp_role_arn: qIamRole.web_exp_role.roleArn,
      boto3Layer: layer,
      idcArn: idcArn
    });
    
    qBusinessConstruct.node.addDependency(layer);
    qBusinessConstruct.node.addDependency(qIamRole);

    new cdk.CfnOutput(this, 'QBusinessAppName', {
      value: qAppName,
      description: 'Amazon Q Business Application Name',
    });

    new cdk.CfnOutput(this, 'QBusinessAppId', {
      value: qBusinessConstruct.appId,
      description: 'Amazon Q Business Application Id',
    });

    new cdk.CfnOutput(this, 'QBusinessAppIndexId', {
      value: qBusinessConstruct.indexId,
      description: 'Amazon Q Business Application Index Id',
    });

    new cdk.CfnOutput(this, 'QBusinessAppDataSourceId', {
      value: qBusinessConstruct.dataSourceId,
      description: 'Amazon Q Business Application Data Source Id',
    });

    // Cognito
    const cognitoConstruct = new CognitoConstruct(this, 'CognitoConstruct', { 
      appArn: qBusinessConstruct.appArn,
      webEndpoint: qBusinessConstruct.webEndpoint,
      cognitoDomainPrefix: cognitoDomainPrefix
    });

    cognitoConstruct.node.addDependency(qBusinessConstruct);

    // Neptune Graph generation
    var neptuneGraphId = '';
    // if (cdk.Fn.conditionEquals(enableGraphParam.valueAsString, 'true')) {
    //   const neptuneConstruct = new AmazonNeptuneConstruct(this, 'NeptuneConstruct', {
    //     qAppName: qAppName
    //   });
    //   neptuneGraphId = neptuneConstruct.graph.attrGraphId;
    // }

    // AWS Batch to run the code analysis
    const awsBatchConstruct = new AwsBatchAnalysisConstruct(this, 'AwsBatchConstruct', {
      qAppRoleArn: qIamRole.app_role.roleArn,
      qAppName: qAppName,
      qAppId: qBusinessConstruct.appId,
      qAppIndexId: qBusinessConstruct.indexId,
      qAppDataSourceId: qBusinessConstruct.dataSourceId,
      repository: repositoryUrl,
      boto3Layer: layer,
      sshUrl: sshUrl,
      sshKeyName: sshKeyName,
      enableResearchAgentParam: enableResearchAgentParam,
      enableGraphParam: enableGraphParam,
      neptuneGraphId: neptuneGraphId,
      cognitoDomain: cognitoConstruct.cognitoDomain,
      userPool: cognitoConstruct.userPool
    });

    awsBatchConstruct.node.addDependency(qBusinessConstruct);

    const customPluginConstruct = new AmazonQPluginConstruct(this, 'CustomPluginConstruct', {
       appId: qBusinessConstruct.appId,
       secretAccessRole: cognitoConstruct.secretAccessRole,
       secret: cognitoConstruct.secret,
       apiUrl: awsBatchConstruct.apiUrl,
       cognitoDomain: cognitoConstruct.cognitoDomain
    });

    customPluginConstruct.node.addDependency(cognitoConstruct);
  }
}
