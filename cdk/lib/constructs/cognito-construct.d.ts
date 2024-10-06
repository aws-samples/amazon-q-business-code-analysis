import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
interface CognitoStackProps extends cdk.StackProps {
    appArn: string;
    webEndpoint: string;
    cognitoDomainPrefix: string;
}
export declare class CognitoConstruct extends Construct {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly cognitoDomain: string;
    readonly secretAccessRole: iam.Role;
    readonly secret: secretsmanager.Secret;
    constructor(scope: Construct, id: string, props: CognitoStackProps);
    private CognitoUserPoolClientSecret;
}
export {};
