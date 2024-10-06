import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
export interface AwsBatchAnalysisProps extends cdk.StackProps {
    readonly qAppName: string;
    readonly qAppId: string;
    readonly qAppIndexId: string;
    readonly qAppDataSourceId: string;
    readonly qAppRoleArn: string;
    readonly repository: string;
    readonly boto3Layer: lambda.LayerVersion;
    readonly sshUrl: string;
    readonly sshKeyName: string;
    readonly neptuneGraphId: string;
    readonly enableGraphParam: cdk.CfnParameter;
    readonly enableResearchAgentParam: cdk.CfnParameter;
    readonly userPool: cognito.UserPool;
    readonly cognitoDomain: string;
    readonly cognitoSecretAccessRole: iam.Role;
    readonly cognitoSecret: secretsmanager.Secret;
}
export declare class AwsBatchAnalysisConstruct extends Construct {
    constructor(scope: Construct, name: string, props: AwsBatchAnalysisProps);
}
