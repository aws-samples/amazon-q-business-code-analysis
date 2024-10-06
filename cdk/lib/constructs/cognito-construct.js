"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitoConstruct = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const constructs_1 = require("constructs");
const iam = require("aws-cdk-lib/aws-iam");
const cr = require("aws-cdk-lib/custom-resources");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");
class CognitoConstruct extends constructs_1.Construct {
    constructor(scope, id, props) {
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
                domainPrefix: props.cognitoDomainPrefix, // This will create a domain like mycompany.auth.region.amazoncognito.com
            },
        });
        this.cognitoDomain = 'https://' + props.cognitoDomainPrefix + '.auth.' + cdk.Stack.of(this).region + '.amazoncognito.com';
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
    CognitoUserPoolClientSecret(userPool, userPoolClient) {
        const describeCognitoUserPoolClient = new cr.AwsCustomResource(this, 'DescribeCognitoUserPoolClient', {
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
        });
        return describeCognitoUserPoolClient.getResponseField('UserPoolClient.ClientSecret');
    }
}
exports.CognitoConstruct = CognitoConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29nbml0by1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb2duaXRvLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsbURBQW1EO0FBQ25ELDJDQUF1QztBQUN2QywyQ0FBMkM7QUFDM0MsbURBQW1EO0FBQ25ELGlFQUFpRTtBQVFqRSxNQUFhLGdCQUFpQixTQUFRLHNCQUFTO0lBTzNDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNwRCxZQUFZLEVBQUUsc0JBQXNCO1lBQ3BDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtZQUM5QixVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO1lBQzNCLGNBQWMsRUFBRTtnQkFDWixTQUFTLEVBQUUsQ0FBQztnQkFDWixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixhQUFhLEVBQUUsSUFBSTtnQkFDbkIsY0FBYyxFQUFFLElBQUk7YUFDdkI7WUFDRCxlQUFlLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxVQUFVO1NBQ3RELENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDL0MsUUFBUTtZQUNSLGFBQWEsRUFBRTtnQkFDWCxZQUFZLEVBQUUsS0FBSyxDQUFDLG1CQUFtQixFQUFHLHlFQUF5RTthQUN0SDtTQUNKLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxhQUFhLEdBQUcsVUFBVSxH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Q0FBQyxNQUFNO2dCQUNqQyxPQUFPLEVBQUUsZ0NBQWdDO2dCQUN6QyxNQUFNLEVBQUUsd0JBQXdCO2dCQUNoQyxVQUFVLEVBQUU7b0JBQ1YsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO29CQUMvQixRQUFRLEVBQUUsY0FBYyxDQUFDLGdCQUFnQjtpQkFDMUM7Z0JBQ0Qsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUM7YUFDOUU7WUFDRCxNQUFNLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLFlBQVksQ0FBQztnQkFDOUMsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQzthQUNsQyxDQUFDO1NBQ0gsQ0FDRixDQUFBO1FBRUQsT0FBTyw2QkFBNkIsQ0FBQyxnQkFBZ0IsQ0FDbkQsNkJBQTZCLENBQzlCLENBQUE7SUFDUCxDQUFDO0NBQ0o7QUEzR0QsNENBMkdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGNyIGZyb20gJ2F3cy1jZGstbGliL2N1c3RvbS1yZXNvdXJjZXMnO1xyXG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xyXG5cclxuaW50ZXJmYWNlIENvZ25pdG9TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gICAgYXBwQXJuOiBzdHJpbmcsXHJcbiAgICB3ZWJFbmRwb2ludDogc3RyaW5nLFxyXG4gICAgY29nbml0b0RvbWFpblByZWZpeDogc3RyaW5nLFxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQ29nbml0b0NvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XHJcbiAgICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XHJcbiAgICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XHJcbiAgICBwdWJsaWMgcmVhZG9ubHkgY29nbml0b0RvbWFpbjogc3RyaW5nO1xyXG4gICAgcHVibGljIHJlYWRvbmx5IHNlY3JldEFjY2Vzc1JvbGU6IGlhbS5Sb2xlO1xyXG4gICAgcHVibGljIHJlYWRvbmx5IHNlY3JldDogc2VjcmV0c21hbmFnZXIuU2VjcmV0O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDb2duaXRvU3RhY2tQcm9wcykge1xyXG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCk7XHJcblxyXG4gICAgICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sJywge1xyXG4gICAgICAgICAgICB1c2VyUG9vbE5hbWU6ICdDdXN0b21QbHVnaW5Vc2VyUG9vbCcsXHJcbiAgICAgICAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxyXG4gICAgICAgICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXHJcbiAgICAgICAgICAgIGF1dG9WZXJpZnk6IHsgZW1haWw6IHRydWUgfSxcclxuICAgICAgICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcclxuICAgICAgICAgICAgICAgIG1pbkxlbmd0aDogOCxcclxuICAgICAgICAgICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy51c2VyUG9vbCA9IHVzZXJQb29sO1xyXG4gICAgICAgIG5ldyBjb2duaXRvLlVzZXJQb29sRG9tYWluKHRoaXMsICdVc2VyUG9vbERvbWFpbicsIHtcclxuICAgICAgICAgICAgdXNlclBvb2wsXHJcbiAgICAgICAgICAgIGNvZ25pdG9Eb21haW46IHtcclxuICAgICAgICAgICAgICAgIGRvbWFpblByZWZpeDogcHJvcHMuY29nbml0b0RvbWFpblByZWZpeCwgIC8vIFRoaXMgd2lsbCBjcmVhdGUgYSBkb21haW4gbGlrZSBteWNvbXBhbnkuYXV0aC5yZWdpb24uYW1hem9uY29nbml0by5jb21cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmNvZ25pdG9Eb21haW4gPSAnaHR0cHM6Ly8nICsgcHJvcHMuY29nbml0b0RvbWFpblByZWZpeCArICcuYXV0aC4nICsgY2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbiArICcuYW1hem9uY29nbml0by5jb20nXHJcblxyXG4gICAgICAgIGNvbnN0IHdyaXRlU2NvcGUgPSBuZXcgY29nbml0by5SZXNvdXJjZVNlcnZlclNjb3BlKHsgc2NvcGVOYW1lOiAnd3JpdGUnLCBzY29wZURlc2NyaXB0aW9uOiAnV3JpdGUgYWNjZXNzJyB9KTtcclxuICAgICAgICAvLyBEZWZpbmUgYSByZXNvdXJjZSBzZXJ2ZXJcclxuICAgICAgICBjb25zdCB1c2VyUG9vbFJlc291cmNlU2VydmVyID0gbmV3IGNvZ25pdG8uVXNlclBvb2xSZXNvdXJjZVNlcnZlcih0aGlzLCAnVXNlclBvb2xSZXNvdXJjZVNlcnZlcicsIHtcclxuICAgICAgICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXHJcbiAgICAgICAgICAgIGlkZW50aWZpZXI6ICdyZXBvc2l0b3J5JyxcclxuICAgICAgICAgICAgc2NvcGVzOiBbd3JpdGVTY29wZV0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnUmVwb3NpdG9yeVVzZXJQb29sQ2xpZW50Jywge1xyXG4gICAgICAgICAgICB1c2VyUG9vbDogdGhpcy51c2VyUG9vbCxcclxuICAgICAgICAgICAgZ2VuZXJhdGVTZWNyZXQ6IHRydWUsXHJcbiAgICAgICAgICAgIG9BdXRoOiB7XHJcbiAgICAgICAgICAgICAgICBzY29wZXM6IFtcclxuICAgICAgICAgICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUucmVzb3VyY2VTZXJ2ZXIodXNlclBvb2xSZXNvdXJjZVNlcnZlciwgd3JpdGVTY29wZSksXHJcbiAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tVcmxzOiBbcHJvcHMud2ViRW5kcG9pbnQgKyBcIm9hdXRoL2NhbGxiYWNrXCJdXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFsbG93cyB5b3UgdG8gcGFzcyB0aGUgZ2VuZXJhdGVkIHNlY3JldCB0byBvdGhlciBwaWVjZXMgb2YgaW5mcmFzdHJ1Y3R1cmVcclxuICAgICAgICBjb25zdCBjbGllbnRTZWNyZXQgPSB0aGlzLkNvZ25pdG9Vc2VyUG9vbENsaWVudFNlY3JldCh0aGlzLnVzZXJQb29sLCB0aGlzLnVzZXJQb29sQ2xpZW50KTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnNlY3JldCA9IG5ldyBzZWNyZXRzbWFuYWdlci5TZWNyZXQodGhpcywgJ09BdXRoU2VjcmV0Jywge1xyXG4gICAgICAgICAgICBzZWNyZXROYW1lOiAnT0F1dGhTZWNyZXQnLFxyXG4gICAgICAgICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xyXG4gICAgICAgICAgICAgICAgc2VjcmV0U3RyaW5nVGVtcGxhdGU6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgICAgICBjbGllbnRfaWQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgICAgICAgICAgICAgICBjbGllbnRfc2VjcmV0OiBjbGllbnRTZWNyZXQsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVkaXJlY3RfdXJpOiBwcm9wcy53ZWJFbmRwb2ludCArIFwib2F1dGgvY2FsbGJhY2tcIixcclxuICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6ICdyYW5kb21QYXNzd29yZCcsXHJcbiAgICAgICAgICAgICAgICBleGNsdWRlUHVuY3R1YXRpb246IHRydWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7IFxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzZXJ2aWNlUHJpbmNpcGFsID0gbmV3IGlhbS5QcmluY2lwYWxXaXRoQ29uZGl0aW9ucyhuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3FidXNpbmVzcy5hbWF6b25hd3MuY29tJyksIHtcclxuICAgICAgICAgICAgJ1N0cmluZ0VxdWFscyc6IHsgJ2F3czpTb3VyY2VBY2NvdW50JzogY2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnQgfSxcclxuICAgICAgICAgICAgJ0FybkVxdWFscyc6IHsgJ2F3czpTb3VyY2VBcm4nOiBwcm9wcy5hcHBBcm4gfSxcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLnNlY3JldEFjY2Vzc1JvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1NlY3JldEFjY2Vzc1JvbGUnLCB7XHJcbiAgICAgICAgICAgIGFzc3VtZWRCeTogc2VydmljZVByaW5jaXBhbCxcclxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQbHVnaW4gUm9sZSB3aXRoIGFjY2VzcyB0byB0aGUgT0F1dGggc2VjcmV0IGluIFNlY3JldHMgTWFuYWdlcicsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICAgIC8vIEdyYW50IHRoZSByb2xlIGFjY2VzcyB0byB0aGUgc2VjcmV0XHJcbiAgICAgICAgdGhpcy5zZWNyZXQuZ3JhbnRSZWFkKHRoaXMuc2VjcmV0QWNjZXNzUm9sZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBDb2duaXRvVXNlclBvb2xDbGllbnRTZWNyZXQodXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2wsIHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50KTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBkZXNjcmliZUNvZ25pdG9Vc2VyUG9vbENsaWVudCA9IG5ldyBjci5Bd3NDdXN0b21SZXNvdXJjZShcclxuICAgICAgICAgICAgdGhpcyxcclxuICAgICAgICAgICAgJ0Rlc2NyaWJlQ29nbml0b1VzZXJQb29sQ2xpZW50JyxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHJlc291cmNlVHlwZTogJ0N1c3RvbTo6RGVzY3JpYmVDb2duaXRvVXNlclBvb2xDbGllbnQnLFxyXG4gICAgICAgICAgICAgIG9uQ3JlYXRlOiB7XHJcbiAgICAgICAgICAgICAgICByZWdpb246IGNkay5TdGFjay5vZih0aGlzKS5yZWdpb24sXHJcbiAgICAgICAgICAgICAgICBzZXJ2aWNlOiAnQ29nbml0b0lkZW50aXR5U2VydmljZVByb3ZpZGVyJyxcclxuICAgICAgICAgICAgICAgIGFjdGlvbjogJ2Rlc2NyaWJlVXNlclBvb2xDbGllbnQnLFxyXG4gICAgICAgICAgICAgICAgcGFyYW1ldGVyczoge1xyXG4gICAgICAgICAgICAgICAgICBVc2VyUG9vbElkOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgICAgICAgICAgICBDbGllbnRJZDogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBwaHlzaWNhbFJlc291cmNlSWQ6IGNyLlBoeXNpY2FsUmVzb3VyY2VJZC5vZih1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkKSxcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHBvbGljeTogY3IuQXdzQ3VzdG9tUmVzb3VyY2VQb2xpY3kuZnJvbVNka0NhbGxzKHtcclxuICAgICAgICAgICAgICAgIHJlc291cmNlczogW3VzZXJQb29sLnVzZXJQb29sQXJuXSxcclxuICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgKVxyXG4gICAgICBcclxuICAgICAgICAgIHJldHVybiBkZXNjcmliZUNvZ25pdG9Vc2VyUG9vbENsaWVudC5nZXRSZXNwb25zZUZpZWxkKFxyXG4gICAgICAgICAgICAnVXNlclBvb2xDbGllbnQuQ2xpZW50U2VjcmV0J1xyXG4gICAgICAgICAgKVxyXG4gICAgfVxyXG59Il19