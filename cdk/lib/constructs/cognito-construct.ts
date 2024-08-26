import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface CognitoStackProps extends cdk.StackProps {
    appArn: string,
    webEndpoint: string,
    cognitoDomainPrefix: string,
}

export class CognitoConstruct extends Construct {
    public readonly userPool: cognito.UserPool;
    public readonly userPoolClient: cognito.UserPoolClient;
    public readonly cognitoDomain: string;
    public readonly secretAccessRole: iam.Role;
    public readonly secret: secretsmanager.Secret;

    constructor(scope: Construct, id: string, props: CognitoStackProps) {
        super(scope, id);

        const userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: 'CustomPluginUserPool',
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            autoVerify: { email: true },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
        });
        this.userPool = userPool;
        new cognito.UserPoolDomain(this, 'UserPoolDomain', {
            userPool,
            cognitoDomain: {
                domainPrefix: props.cognitoDomainPrefix,  // This will create a domain like mycompany.auth.region.amazoncognito.com
            },
        });
        this.cognitoDomain = 'https://' + props.cognitoDomainPrefix + '.auth.' + cdk.Stack.of(this).region + '.amazoncognito.com'

        const writeScope = new cognito.ResourceServerScope({ scopeName: 'write', scopeDescription: 'Write access' });
        // Define a resource server
        const userPoolResourceServer = new cognito.UserPoolResourceServer(this, 'UserPoolResourceServer', {
            userPool: this.userPool,
            identifier: 'repository',
            scopes: [writeScope],
        });

        this.userPoolClient = new cognito.UserPoolClient(this, 'RepositoryUserPoolClient', {
            userPool: this.userPool,
            generateSecret: true,
            oAuth: {
                scopes: [
                    cognito.OAuthScope.resourceServer(userPoolResourceServer, writeScope),
                ],
                callbackUrls: [props.webEndpoint + "oauth/callback"]
            },
        });

        // Allows you to pass the generated secret to other pieces of infrastructure
        const clientSecret = this.CognitoUserPoolClientSecret(this.userPool, this.userPoolClient);
        
        this.secret = new secretsmanager.Secret(this, 'OAuthSecret', {
            secretName: 'OAuthSecret',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    client_id: this.userPoolClient.userPoolClientId,
                    client_secret: clientSecret,
                    redirect_uri: props.webEndpoint + "oauth/callback",
                }),
                generateStringKey: 'randomPassword',
                excludePunctuation: true,
            },
        }); 
        
        var servicePrincipal = new iam.PrincipalWithConditions(new iam.ServicePrincipal('qbusiness.amazonaws.com'), {
            'StringEquals': { 'aws:SourceAccount': cdk.Stack.of(this).account },
            'ArnEquals': { 'aws:SourceArn': props.appArn },
        });
        this.secretAccessRole = new iam.Role(this, 'SecretAccessRole', {
            assumedBy: servicePrincipal,
            description: 'Plugin Role with access to the OAuth secret in Secrets Manager',
        });
      
        // Grant the role access to the secret
        this.secret.grantRead(this.secretAccessRole);
    }

    private CognitoUserPoolClientSecret(userPool: cognito.UserPool, userPoolClient: cognito.UserPoolClient): string {
        const describeCognitoUserPoolClient = new cr.AwsCustomResource(
            this,
            'DescribeCognitoUserPoolClient',
            {
              resourceType: 'Custom::DescribeCognitoUserPoolClient',
              onCreate: {
                region: cdk.Stack.of(this).region,
                service: 'CognitoIdentityServiceProvider',
                action: 'describeUserPoolClient',
                parameters: {
                  UserPoolId: userPool.userPoolId,
                  ClientId: userPoolClient.userPoolClientId,
                },
                physicalResourceId: cr.PhysicalResourceId.of(userPoolClient.userPoolClientId),
              },
              policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [userPool.userPoolArn],
              }),
            }
          )
      
          return describeCognitoUserPoolClient.getResponseField(
            'UserPoolClient.ClientSecret'
          )
    }
}