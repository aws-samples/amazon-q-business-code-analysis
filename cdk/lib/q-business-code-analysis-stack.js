"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QBusinessCodeAnalysisStack = void 0;
const cdk = require("aws-cdk-lib");
const custom_amazon_q_construct_1 = require("./constructs/custom-amazon-q-construct");
const q_iam_role_construct_1 = require("./constructs/q-iam-role-construct");
const aws_batch_analysis_construct_1 = require("./constructs/aws-batch-analysis-construct");
const cognito_construct_1 = require("./constructs/cognito-construct");
class QBusinessCodeAnalysisStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        const qIamRole = new q_iam_role_construct_1.QIamRoleConstruct(this, `QIamConstruct`, {
            roleName: qAppRoleName
        });
        const layer = new cdk.aws_lambda.LayerVersion(this, 'layerWithQBusiness', {
            code: cdk.aws_lambda.Code.fromAsset('lib/assets/lambda-layer/boto3_v1.34.109_py3.12.zip'),
            compatibleRuntimes: [cdk.aws_lambda.Runtime.PYTHON_3_12],
            description: 'Boto3 v1.34.109',
        });
        const qBusinessConstruct = new custom_amazon_q_construct_1.CustomQBusinessConstruct(this, 'QBusinessAppConstruct', {
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
        const cognitoConstruct = new cognito_construct_1.CognitoConstruct(this, 'CognitoConstruct', {
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
        const awsBatchConstruct = new aws_batch_analysis_construct_1.AwsBatchAnalysisConstruct(this, 'AwsBatchConstruct', {
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
            userPool: cognitoConstruct.userPool,
            cognitoSecretAccessRole: cognitoConstruct.secretAccessRole,
            cognitoSecret: cognitoConstruct.secret
        });
        awsBatchConstruct.node.addDependency(qBusinessConstruct);
    }
}
exports.QBusinessCodeAnalysisStack = QBusinessCodeAnalysisStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicS1idXNpbmVzcy1jb2RlLWFuYWx5c2lzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicS1idXNpbmVzcy1jb2RlLWFuYWx5c2lzLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyxzRkFBaUY7QUFDakYsNEVBQXNFO0FBQ3RFLDRGQUFzRjtBQUV0RixzRUFBa0U7QUFFbEUsTUFBYSwwQkFBMkIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN2RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDZCQUE2QjtRQUM3QixJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsR0FBRywwREFBMEQsQ0FBQztRQUU5RixNQUFNLFlBQVksR0FBRyxxQ0FBcUMsQ0FBQztRQUUzRCwwRkFBMEY7UUFDMUYsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNqRSxJQUFJLEVBQUUsUUFBUTtZQUNkLFdBQVcsRUFBRSxpREFBaUQ7WUFDOUQsY0FBYyxFQUFFLDZCQUE2QjtTQUM5QyxDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3JFLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLGlLQUFpSztZQUM5SyxjQUFjLEVBQUUsc0JBQXNCO1NBQ3ZDLENBQUMsQ0FBQztRQUVILHlCQUF5QjtRQUN6QixNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUN2RCxJQUFJLEVBQUUsUUFBUTtZQUNkLFdBQVcsRUFBRSx1S0FBdUs7WUFDcEwsT0FBTyxFQUFFLE1BQU07U0FDaEIsQ0FBQyxDQUFD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SUFBSSx3REFBeUIsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDakYsV0FBVyxFQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsT0FBTztZQUN0QyxRQUFRLEVBQUUsUUFBUTtZQUNsQixNQUFNLEVBQUUsa0JBQWtCLENBQUMsS0FBSztZQUNoQyxXQUFXLEVBQUUsa0JBQWtCLENBQUMsT0FBTztZQUN2QyxnQkFBZ0IsRUFBRSxrQkFBa0IsQ0FBQyxZQUFZO1lBQ2pELFVBQVUsRUFBRSxhQUFhO1lBQ3pCLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLE1BQU0sRUFBRSxNQUFNO1lBQ2QsVUFBVSxFQUFFLFVBQVU7WUFDdEIsd0JBQXdCLEVBQUUsd0JBQXdCO1lBQ2xELGdCQUFnQixFQUFFLGdCQUFnQjtZQUNsQyxjQUFjLEVBQUUsY0FBYztZQUM5QixhQUFhLEVBQUUsZ0JBQWdCLENBQUMsYUFBYTtZQUM3QyxRQUFRLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtZQUNuQyx1QkFBdUIsRUFBRSxnQkFBZ0IsQ0FBQyxnQkFBZ0I7WUFDMUQsYUFBYSxFQUFFLGdCQUFnQixDQUFDLE1BQU07U0FDdkMsQ0FBQyxDQUFDO1FBRUgsaUJBQWlCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQzNELENBQUM7Q0FDRjtBQTNKRCxnRUEySkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuaW1wb3J0IHsgQ3VzdG9tUUJ1c2luZXNzQ29uc3RydWN0IH0gZnJvbSAnLi9jb25zdHJ1Y3RzL2N1c3RvbS1hbWF6b24tcS1jb25zdHJ1Y3QnXHJcbmltcG9ydCB7IFFJYW1Sb2xlQ29uc3RydWN0IH0gZnJvbSAnLi9jb25zdHJ1Y3RzL3EtaWFtLXJvbGUtY29uc3RydWN0JztcclxuaW1wb3J0IHsgQXdzQmF0Y2hBbmFseXNpc0NvbnN0cnVjdCB9IGZyb20gJy4vY29uc3RydWN0cy9hd3MtYmF0Y2gtYW5hbHlzaXMtY29uc3RydWN0JztcclxuaW1wb3J0IHsgQW1hem9uTmVwdHVuZUNvbnN0cnVjdCB9IGZyb20gJy4vY29uc3RydWN0cy9hbWF6b24tbmVwdHVuZS1jb25zdHJ1Y3QnO1xyXG5pbXBvcnQgeyBDb2duaXRvQ29uc3RydWN0IH0gZnJvbSAnLi9jb25zdHJ1Y3RzL2NvZ25pdG8tY29uc3RydWN0JztcclxuXHJcbmV4cG9ydCBjbGFzcyBRQnVzaW5lc3NDb2RlQW5hbHlzaXNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gQ2xvdWRmb3JtYXRpb24gRGVzY3JpcHRpb25cclxuICAgIHRoaXMudGVtcGxhdGVPcHRpb25zLmRlc2NyaXB0aW9uID0gJyh1a3NiLTF0dXBib2M1NSkgLSBBbWF6b24gUSBCdXNpbmVzcyBDb2RlIEFuYWx5c2lzIHN0YWNrJztcclxuXHJcbiAgICBjb25zdCBxQXBwUm9sZU5hbWUgPSAnUUJ1c2luZXNzLUFwcGxpY2F0aW9uLUNvZGUtQW5hbHlzaXMnO1xyXG5cclxuICAgIC8vIElucHV0IFByb2plY3QgbmFtZSB0aGF0IHNhdGlzZmllcyByZWd1bGFyIGV4cHJlc3Npb24gcGF0dGVybjogW2EtekEtWjAtOV1bYS16QS1aMC05Xy1dKlxyXG4gICAgY29uc3QgcHJvamVjdE5hbWVQYXJhbSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdQcm9qZWN0TmFtZScsIHtcclxuICAgICAgdHlwZTogJ1N0cmluZycsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGhlIHByb2plY3QgbmFtZSwgZm9yIGV4YW1wbGUgbGFuZ2NoYWluLWFnZW50cy4nLFxyXG4gICAgICBhbGxvd2VkUGF0dGVybjogJ15bYS16QS1aMC05XVthLXpBLVowLTlfLV0qJCdcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJlcG9zaXRvcnlVcmxQYXJhbSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdSZXBvc2l0b3J5VXJsJywge1xyXG4gICAgICB0eXBlOiAnU3RyaW5nJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdUaGUgR2l0IFVSTCBvZiB0aGUgcmVwb3NpdG9yeSB0byBzY2FuIGFuZCBpbmdlc3QgaW50byBBbWF6b24gUSBCdXNpbmVzcy4gTm90ZSBpdCBzaG91bGQgZW5kIHdpdGggLmdpdCwgaS5lLiBodHRwczovL2dpdGh1Yi5jb20vYXdzLXNhbXBsZXMvbGFuZ2NoYWluLWFnZW50cy5naXQnLFxyXG4gICAgICBhbGxvd2VkUGF0dGVybjogJ15odHRwcz86Ly8uKyhcXC5naXQpJCdcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE9wdGlvbmFsIFNTSCBVUkwgUGFyYW1cclxuICAgIGNvbnN0IHNzaFVybFBhcmFtID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgJ1NzaFVybCcsIHtcclxuICAgICAgdHlwZTogJ1N0cmluZycsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3B0aW9uYWwuIFRoZSBTU0ggVVJMIG9mIHRoZSByZXBvc2l0b3J5IHRvIHNjYW4gYW5kIGluZ2VzdCBpbnRvIEFtYXpvbiBRIEJ1c2luZXNzLiBOb3RlIGl0IHNob3VsZCBlbmQgd2l0aCAuZ2l0LCBpLmUuIGdpdEBnaXRodWIuY29tOmF3cy1zYW1wbGVzL2xhbmdjaGFpbi1hZ2VudHMuZ2l0JyxcclxuICAgICAgZGVmYXVsdDogJ05vbmUnXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBPcHRpb25hbCBTU0ggS2V5IFBhcmFtIE5hbWVcclxuICAgIGNvbnN0IHNzaEtleU5hbWVQYXJhbSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdTc2hTZWNyZXROYW1lJywge1xyXG4gICAgICB0eXBlOiAnU3RyaW5nJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdPcHRpb25hbC4gVGhlIG5hbWUgb2YgdGhlIFNTSCBrZXkgdG8gdXNlIHRvIGFjY2VzcyB0aGUgcmVwb3NpdG9yeS4gSXQgc2hvdWxkIGJlIHRoZSBuYW1lIG9mIHRoZSBTU0gga2V5IHN0b3JlZCBpbiB0aGUgQVdTIFN5c3RlbXMgTWFuYWdlciBQYXJhbWV0ZXIgU3RvcmUuJyxcclxuICAgICAgZGVmYXVsdDogJ05vbmUnXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBpZGNBcm5QYXJhbSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdJZGNBcm4nLCB7XHJcbiAgICAgIHR5cGU6ICdTdHJpbmcnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBhcm4gb2YgSWRlbnRpdHkgQ2VudGVyIGluIHRoZSBzYW1lIHJlZ2lvbiB0aGF0IHRoZSBRIGFwcGxpY2F0aW9uIGlzIGdvaW5nIHRvIGJlIGRlcGxveWVkJyxcclxuICAgICAgYWxsb3dlZFBhdHRlcm46ICdeYXJuOmF3c1thLXpBLVowLTktXSo6c3NvOlthLXowLTktXSo6WzAtOV17MTJ9Omluc3RhbmNlXFwvLiokfF5hcm46YXdzOnNzbzo6Omluc3RhbmNlXFwvLiokJyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGVuYWJsZUdyYXBoUGFyYW0gPSBuZXcgY2RrLkNmblBhcmFtZXRlcih0aGlzLCAnRW5hYmxlR3JhcGgnLCB7XHJcbiAgICAgIHR5cGU6ICdTdHJpbmcnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0VuYWJsZSB0aGUgTmVwdHVuZSBHcmFwaC4gU2V0IHRvIHRydWUgdG8gZW5hYmxlIHRoZSBncmFwaCwgZmFsc2UgdG8gZGlzYWJsZSBpdC4nLFxyXG4gICAgICBhbGxvd2VkVmFsdWVzOiBbJ3RydWUnLCAnZmFsc2UnXSxcclxuICAgICAgZGVmYXVsdDogJ2ZhbHNlJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZW5hYmxlUmVzZWFyY2hBZ2VudFBhcmFtID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgJ0VuYWJsZVJlc2VhcmNoQWdlbnQnLCB7XHJcbiAgICAgIHR5cGU6ICdTdHJpbmcnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0VuYWJsZSB0aGUgUmVzZWFyY2ggQWdlbnQuIFNldCB0byB0cnVlIHRvIGVuYWJsZSB0aGUgcmVzZWFyY2ggYWdlbnQsIGZhbHNlIHRvIGRpc2FibGUgaXQuJyxcclxuICAgICAgYWxsb3dlZFZhbHVlczogWyd0cnVlJywgJ2ZhbHNlJ10sXHJcbiAgICAgIGRlZmF1bHQ6ICdmYWxzZSdcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFRoZSBjb2duaXRvIGRvbWFpbiBwcmVmaXggdGhhdCBzYXRpc2ZpZXMgcmVndWxhciBleHByZXNzaW9uIHBhdHRlcm46IFthLXpBLVowLTldW2EtekEtWjAtOV8tXSpcclxuICAgIGNvbnN0IGNvZ25pdG9Eb21haW5QcmVmaXhQYXJhbSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdDb2duaXRvRG9tYWluUHJlZml4Jywge1xyXG4gICAgICB0eXBlOiAnU3RyaW5nJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdUaGUgY29nbml0byBkb21haW4gcHJlZml4LicsXHJcbiAgICAgIGFsbG93ZWRQYXR0ZXJuOiAnXlthLXpBLVowLTldW2EtekEtWjAtOV8tXSokJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ2hlY2sgaWYgdGhlIHJlcG9zaXRvcnkgdXJsIGlzIHByb3ZpZGVkXHJcbiAgICBjb25zdCByZXBvc2l0b3J5VXJsID0gcmVwb3NpdG9yeVVybFBhcmFtLnZhbHVlQXNTdHJpbmc7XHJcbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IHByb2plY3ROYW1lUGFyYW0udmFsdWVBc1N0cmluZztcclxuICAgIGNvbnN0IHNzaFVybCA9IHNzaFVybFBhcmFtLnZhbHVlQXNTdHJpbmc7XHJcbiAgICBjb25zdCBzc2hLZXlOYW1lID0gc3NoS2V5TmFtZVBhcmFtLnZhbHVlQXNTdHJpbmc7XHJcbiAgICBjb25zdCBjb2duaXRvRG9tYWluUHJlZml4ID0gY29nbml0b0RvbWFpblByZWZpeFBhcmFtLnZhbHVlQXNTdHJpbmc7XHJcbiAgICAvLyBCb29sZWFuIGV2YWx1YXRpb25zXHJcblxyXG4gICAgY29uc3QgcUFwcE5hbWUgPSBwcm9qZWN0TmFtZTtcclxuICAgIGNvbnN0IGlkY0FybiA9IGlkY0FyblBhcmFtLnZhbHVlQXNTdHJpbmc7XHJcblxyXG4gICAgY29uc3QgcUlhbVJvbGUgPSBuZXcgUUlhbVJvbGVDb25zdHJ1Y3QodGhpcywgYFFJYW1Db25zdHJ1Y3RgLCB7XHJcbiAgICAgIHJvbGVOYW1lOiBxQXBwUm9sZU5hbWVcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGxheWVyID0gbmV3IGNkay5hd3NfbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnbGF5ZXJXaXRoUUJ1c2luZXNzJywge1xyXG4gICAgICBjb2RlOiBjZGsuYXdzX2xhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGliL2Fzc2V0cy9sYW1iZGEtbGF5ZXIvYm90bzNfdjEuMzQuMTA5X3B5My4xMi56aXAnKSxcclxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbY2RrLmF3c19sYW1iZGEuUnVudGltZS5QWVRIT05fM18xMl0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQm90bzMgdjEuMzQuMTA5JyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHFCdXNpbmVzc0NvbnN0cnVjdCA9IG5ldyBDdXN0b21RQnVzaW5lc3NDb25zdHJ1Y3QodGhpcywgJ1FCdXNpbmVzc0FwcENvbnN0cnVjdCcsIHtcclxuICAgICAgYW1hem9uX3FfYXBwX25hbWU6IHFBcHBOYW1lLFxyXG4gICAgICBhbWF6b25fcV9hcHBfcm9sZV9hcm46IHFJYW1Sb2xlLmFwcF9yb2xlLnJvbGVBcm4sXHJcbiAgICAgIGFtYXpvbl9xX3dlYl9leHBfcm9sZV9hcm46IHFJYW1Sb2xlLndlYl9leHBfcm9sZS5yb2xlQXJuLFxyXG4gICAgICBib3RvM0xheWVyOiBsYXllcixcclxuICAgICAgaWRjQXJuOiBpZGNBcm5cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBxQnVzaW5lc3NDb25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KGxheWVyKTtcclxuICAgIHFCdXNpbmVzc0NvbnN0cnVjdC5ub2RlLmFkZERlcGVuZGVuY3kocUlhbVJvbGUpO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdRQnVzaW5lc3NBcHBOYW1lJywge1xyXG4gICAgICB2YWx1ZTogcUFwcE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIFEgQnVzaW5lc3MgQXBwbGljYXRpb24gTmFtZScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUUJ1c2luZXNzQXBwSWQnLCB7XHJcbiAgICAgIHZhbHVlOiBxQnVzaW5lc3NDb25zdHJ1Y3QuYXBwSWQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIFEgQnVzaW5lc3MgQXBwbGljYXRpb24gSWQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1FCdXNpbmVzc0FwcEluZGV4SWQnLCB7XHJcbiAgICAgIHZhbHVlOiBxQnVzaW5lc3NDb25zdHJ1Y3QuaW5kZXhJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBbWF6b24gUSBCdXNpbmVzcyBBcHBsaWNhdGlvbiBJbmRleCBJZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUUJ1c2luZXNzQXBwRGF0YVNvdXJjZUlkJywge1xyXG4gICAgICB2YWx1ZTogcUJ1c2luZXNzQ29uc3RydWN0LmRhdGFTb3VyY2VJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBbWF6b24gUSBCdXNpbmVzcyBBcHBsaWNhdGlvbiBEYXRhIFNvdXJjZSBJZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDb2duaXRvXHJcbiAgICBjb25zdCBjb2duaXRvQ29uc3RydWN0ID0gbmV3IENvZ25pdG9Db25zdHJ1Y3QodGhpcywgJ0NvZ25pdG9Db25zdHJ1Y3QnLCB7IFxyXG4gICAgICBhcHBBcm46IHFCdXNpbmVzc0NvbnN0cnVjdC5hcHBBcm4sXHJcbiAgICAgIHdlYkVuZHBvaW50OiBxQnVzaW5lc3NDb25zdHJ1Y3Qud2ViRW5kcG9pbnQsXHJcbiAgICAgIGNvZ25pdG9Eb21haW5QcmVmaXg6IGNvZ25pdG9Eb21haW5QcmVmaXhcclxuICAgIH0pO1xyXG5cclxuICAgIGNvZ25pdG9Db25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KHFCdXNpbmVzc0NvbnN0cnVjdCk7XHJcblxyXG4gICAgLy8gTmVwdHVuZSBHcmFwaCBnZW5lcmF0aW9uXHJcbiAgICB2YXIgbmVwdHVuZUdyYXBoSWQgPSAnJztcclxuICAgIC8vIGlmIChjZGsuRm4uY29uZGl0aW9uRXF1YWxzKGVuYWJsZUdyYXBoUGFyYW0udmFsdWVBc1N0cmluZywgJ3RydWUnKSkge1xyXG4gICAgLy8gICBjb25zdCBuZXB0dW5lQ29uc3RydWN0ID0gbmV3IEFtYXpvbk5lcHR1bmVDb25zdHJ1Y3QodGhpcywgJ05lcHR1bmVDb25zdHJ1Y3QnLCB7XHJcbiAgICAvLyAgICAgcUFwcE5hbWU6IHFBcHBOYW1lXHJcbiAgICAvLyAgIH0pO1xyXG4gICAgLy8gICBuZXB0dW5lR3JhcGhJZCA9IG5lcHR1bmVDb25zdHJ1Y3QuZ3JhcGguYXR0ckdyYXBoSWQ7XHJcbiAgICAvLyB9XHJcblxyXG4gICAgLy8gQVdTIEJhdGNoIHRvIHJ1biB0aGUgY29kZSBhbmFseXNpc1xyXG4gICAgY29uc3QgYXdzQmF0Y2hDb25zdHJ1Y3QgPSBuZXcgQXdzQmF0Y2hBbmFseXNpc0NvbnN0cnVjdCh0aGlzLCAnQXdzQmF0Y2hDb25zdHJ1Y3QnLCB7XHJcbiAgICAgIHFBcHBSb2xlQXJuOiBxSWFtUm9sZS5hcHBfcm9sZS5yb2xlQXJuLFxyXG4gICAgICBxQXBwTmFtZTogcUFwcE5hbWUsXHJcbiAgICAgIHFBcHBJZDogcUJ1c2luZXNzQ29uc3RydWN0LmFwcElkLFxyXG4gICAgICBxQXBwSW5kZXhJZDogcUJ1c2luZXNzQ29uc3RydWN0LmluZGV4SWQsXHJcbiAgICAgIHFBcHBEYXRhU291cmNlSWQ6IHFCdXNpbmVzc0NvbnN0cnVjdC5kYXRhU291cmNlSWQsXHJcbiAgICAgIHJlcG9zaXRvcnk6IHJlcG9zaXRvcnlVcmwsXHJcbiAgICAgIGJvdG8zTGF5ZXI6IGxheWVyLFxyXG4gICAgICBzc2hVcmw6IHNzaFVybCxcclxuICAgICAgc3NoS2V5TmFtZTogc3NoS2V5TmFtZSxcclxuICAgICAgZW5hYmxlUmVzZWFyY2hBZ2VudFBhcmFtOiBlbmFibGVSZXNlYXJjaEFnZW50UGFyYW0sXHJcbiAgICAgIGVuYWJsZUdyYXBoUGFyYW06IGVuYWJsZUdyYXBoUGFyYW0sXHJcbiAgICAgIG5lcHR1bmVHcmFwaElkOiBuZXB0dW5lR3JhcGhJZCxcclxuICAgICAgY29nbml0b0RvbWFpbjogY29nbml0b0NvbnN0cnVjdC5jb2duaXRvRG9tYWluLFxyXG4gICAgICB1c2VyUG9vbDogY29nbml0b0NvbnN0cnVjdC51c2VyUG9vbCxcclxuICAgICAgY29nbml0b1NlY3JldEFjY2Vzc1JvbGU6IGNvZ25pdG9Db25zdHJ1Y3Quc2VjcmV0QWNjZXNzUm9sZSxcclxuICAgICAgY29nbml0b1NlY3JldDogY29nbml0b0NvbnN0cnVjdC5zZWNyZXRcclxuICAgIH0pO1xyXG5cclxuICAgIGF3c0JhdGNoQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeShxQnVzaW5lc3NDb25zdHJ1Y3QpO1xyXG4gIH1cclxufVxyXG4iXX0=