import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { aws_qbusiness as qbusiness } from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface AmazonQPluginStackProps extends cdk.StackProps {
    appId: string,
    secretAccessRole: iam.Role;
    secret: secretsmanager.Secret;
}

export class AmazonQPluginConstruct extends Construct {
    constructor(scope: Construct, id: string, props: AmazonQPluginStackProps) {
        super(scope, id);
       
        const cfnPlugin = new qbusiness.CfnPlugin(this, 'RepositoryPlugin', {
            applicationId: props.appId,
            authConfiguration: {
                oAuth2ClientCredentialConfiguration: {
                    roleArn: props.secretAccessRole.roleArn,
                    secretArn: props.secret.secretArn,
                },
            },
            displayName: 'RepositoryPlugin',
            type: 'CUSTOM',

            customPluginConfiguration: {
                apiSchema: { s3: {
                    bucket: 'qbusinesscodeanalysiscdks-awsbatchconstructcodepro-phak6d4madac',
                    key: 'openapi-schema.json',
                } },
                apiSchemaType: 'OPEN_API_V3',
                description: 'Custom Plugin Description',
            },
        });
    }
}