"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QIamRoleConstruct = void 0;
const cdk = require("aws-cdk-lib");
const constructs_1 = require("constructs");
const defaultProps = {};
class QIamRoleConstruct extends constructs_1.Construct {
    constructor(parent, name, props) {
        super(parent, name);
        props = { ...defaultProps, ...props };
        const region = cdk.Stack.of(this).region;
        const awsAccountId = cdk.Stack.of(this).account;
        const role = new cdk.aws_iam.Role(this, "QIamRoleApp", {
            assumedBy: new cdk.aws_iam.ServicePrincipal("qbusiness.amazonaws.com", {
                conditions: {
                    StringEquals: {
                        "aws:SourceAccount": awsAccountId,
                    }
                }
            }),
            inlinePolicies: {
                "AmazonQApplicationPutMetricDataPermission": new cdk.aws_iam.PolicyDocument({
                    statements: [
                        new cdk.aws_iam.PolicyStatement({
                            actions: ["cloudwatch:PutMetricData"],
                            resources: ["*"],
                            effect: cdk.aws_iam.Effect.ALLOW,
                            conditions: {
                                StringEquals: {
                                    "cloudwatch:namespace": "AWS/QBusiness",
                                },
                            },
                        }),
                    ],
                }),
                "AmazonQApplicationDescribeLogGroupsPermission": new cdk.aws_iam.PolicyDocument({
                    statements: [
                        new cdk.aws_iam.PolicyStatement({
                            actions: ["logs:DescribeLogGroups"],
                            resources: ["*"],
                            effect: cdk.aws_iam.Effect.ALLOW,
                        }),
                    ],
                }),
                "AmazonQApplicationCreateLogGroupPermission": new cdk.aws_iam.PolicyDocument({
                    statements: [
                        new cdk.aws_iam.PolicyStatement({
                            actions: ["logs:CreateLogGroup"],
                            resources: [`arn:aws:logs:${region}:${awsAccountId}:log-group:/aws/qbusiness/*`],
                            effect: cdk.aws_iam.Effect.ALLOW,
                        }),
                    ],
                }),
                "AmazonQApplicationLogStreamPermission": new cdk.aws_iam.PolicyDocument({
                    statements: [
                        new cdk.aws_iam.PolicyStatement({
                            actions: ["logs:DescribeLogStreams",
                                "logs:CreateLogStream",
                                "logs:PutLogEvents"],
                            resources: [`arn:aws:logs:${region}:${awsAccountId}:log-group:/aws/qbusiness/*:log-stream:*`],
                            effect: cdk.aws_iam.Effect.ALLOW,
                        }),
                    ],
                }),
                "QBusinessUserSubscriptionPermissions": new cdk.aws_iam.PolicyDocument({
                    statements: [
                        new cdk.aws_iam.PolicyStatement({
                            actions: [
                                "qbusiness:CreateSubscription",
                                "qbusiness:UpdateSubscription",
                                "qbusiness:CancelSubscription",
                                "qbusiness:ListSubscriptions",
                                "user-subscriptions:CreateClaim",
                                "user-subscriptions:UpdateClaim",
                                "user-subscriptions:CommitClaim"
                            ],
                            resources: [`arn:aws:qbusiness:${region}:${awsAccountId}:application/*`],
                            effect: cdk.aws_iam.Effect.ALLOW,
                        }),
                    ],
                }),
            },
        });
        new cdk.CfnOutput(this, "QBusinessRoleArn", {
            value: role.roleArn,
        });
        this.app_role = role;
        const web_role = new cdk.aws_iam.Role(this, "QIamRoleWebExp", {
            assumedBy: new cdk.aws_iam.ServicePrincipal("application.qbusiness.amazonaws.com", {
                conditions: {
                    StringEquals: {
                        "aws:SourceAccount": awsAccountId,
                    }
                }
            }),
            inlinePolicies: {
                "QBusinessConversationPermission": new cdk.aws_iam.PolicyDocument({
                    statements: [
                        new cdk.aws_iam.PolicyStatement({
                            actions: [
                                "qbusiness:Chat",
                                "qbusiness:ChatSync",
                                "qbusiness:ListMessages",
                                "qbusiness:ListConversations",
                                "qbusiness:DeleteConversation",
                                "qbusiness:PutFeedback",
                                "qbusiness:GetWebExperience",
                                "qbusiness:GetApplication",
                                "qbusiness:ListPlugins",
                                "qbusiness:GetChatControlsConfiguration"
                            ],
                            resources: [`arn:aws:qbusiness:${region}:${awsAccountId}:application/*`],
                            effect: cdk.aws_iam.Effect.ALLOW,
                        }),
                    ],
                }),
            },
        });
        const web_role_cfn = web_role.node.findChild('Resource');
        web_role_cfn.assumeRolePolicyDocument.statements[0].addActions("sts:SetContext");
        new cdk.CfnOutput(this, "QBusinessWebExpRoleArn", {
            value: web_role.roleArn,
        });
        this.web_exp_role = web_role;
    }
}
exports.QIamRoleConstruct = QIamRoleConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicS1pYW0tcm9sZS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJxLWlhbS1yb2xlLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsMkNBQXFDO0FBTXJDLE1BQU0sWUFBWSxHQUEyQixFQUFFLENBQUM7QUFFaEQsTUFBYSxpQkFBa0IsU0FBUSxzQkFBUztJQUk1QyxZQUFZLE1BQWlCLEVBQUUsSUFBWSxFQUFFLEtBQW9CO1FBQzdELEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFcEIsS0FBSyxHQUFHLEVBQUMsR0FBRyxZQUFZLEVBQUUsR0FBRyxLQUFLLEVBQUMsQ0FBQztRQUVwQyxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUE7UUFDeEMsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDO1FBRWhELE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNuRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLHlCQUF5QixFQUFFO2dCQUNuRSxVQUFVLEVBQUU7b0JBQ1IsWUFBWSxFQUFFO3dCQUNWLG1CQUFtQixFQUFFLFlBQVk7cUJBQ3BDO2lCQUNKO2FBQ0osQ0FBQztZQUNGLGNBQWMsRUFBRTtnQkFDWiwyQ0FBMkMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDO29CQUNwRSxVQUFVLEVBQUU7d0JBQ1IsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQzs0QkFDNUIsT0FBTyxFQUFFLENBQUMsMEJBQTBCLENBQUM7NEJBQ3JDLFNBQVMsRUFBRSxDQUFD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QyxPQUFPLENBQUMsY0FBYyxDQUFDO29CQUMxRCxVQUFVLEVBQUU7d0JBQ1IsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQzs0QkFDNUIsT0FBTyxFQUFFO2dDQUNMLGdCQUFnQjtnQ0FDaEIsb0JBQW9CO2dDQUNwQix3QkFBd0I7Z0NBQ3hCLDZCQUE2QjtnQ0FDN0IsOEJBQThCO2dDQUM5Qix1QkFBdUI7Z0NBQ3ZCLDRCQUE0QjtnQ0FDNUIsMEJBQTBCO2dDQUMxQix1QkFBdUI7Z0NBQ3ZCLHdDQUF3Qzs2QkFBQzs0QkFDN0MsU0FBUyxFQUFFLENBQUMscUJBQXFCLE1BQU0sSUFBSSxZQUFZLGdCQUFnQixDQUFDOzRCQUN4RSxNQUFNLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSzt5QkFDbkMsQ0FBQztxQkFDTDtpQkFDSixDQUNKO2FBQ0o7U0FDSixDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQXdCLENBQUM7UUFDaEYsWUFBWSxDQUFDLHdCQUF3QixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUdqRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQzlDLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTztTQUMxQixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsWUFBWSxHQUFHLFFBQVEsQ0FBQztJQUNqQyxDQUFDO0NBQ0o7QUF4SUQsOENBd0lDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xyXG5pbXBvcnQge0NvbnN0cnVjdH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUUlhbVJvbGVQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICAgIHJlYWRvbmx5IHJvbGVOYW1lOiBzdHJpbmc7XHJcbn1cclxuXHJcbmNvbnN0IGRlZmF1bHRQcm9wczogUGFydGlhbDxRSWFtUm9sZVByb3BzPiA9IHt9O1xyXG5cclxuZXhwb3J0IGNsYXNzIFFJYW1Sb2xlQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcclxuICAgIHB1YmxpYyBhcHBfcm9sZTogY2RrLmF3c19pYW0uUm9sZTtcclxuICAgIHB1YmxpYyB3ZWJfZXhwX3JvbGU6IGNkay5hd3NfaWFtLlJvbGU7XHJcblxyXG4gICAgY29uc3RydWN0b3IocGFyZW50OiBDb25zdHJ1Y3QsIG5hbWU6IHN0cmluZywgcHJvcHM6IFFJYW1Sb2xlUHJvcHMpIHtcclxuICAgICAgICBzdXBlcihwYXJlbnQsIG5hbWUpO1xyXG5cclxuICAgICAgICBwcm9wcyA9IHsuLi5kZWZhdWx0UHJvcHMsIC4uLnByb3BzfTtcclxuXHJcbiAgICAgICAgY29uc3QgcmVnaW9uID0gY2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvblxyXG4gICAgICAgIGNvbnN0IGF3c0FjY291bnRJZCA9IGNkay5TdGFjay5vZih0aGlzKS5hY2NvdW50O1xyXG5cclxuICAgICAgICBjb25zdCByb2xlID0gbmV3IGNkay5hd3NfaWFtLlJvbGUodGhpcywgXCJRSWFtUm9sZUFwcFwiLCB7XHJcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGNkay5hd3NfaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJxYnVzaW5lc3MuYW1hem9uYXdzLmNvbVwiLCB7XHJcbiAgICAgICAgICAgICAgICBjb25kaXRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgU3RyaW5nRXF1YWxzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiYXdzOlNvdXJjZUFjY291bnRcIjogYXdzQWNjb3VudElkLFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIGlubGluZVBvbGljaWVzOiB7XHJcbiAgICAgICAgICAgICAgICBcIkFtYXpvblFBcHBsaWNhdGlvblB1dE1ldHJpY0RhdGFQZXJtaXNzaW9uXCI6IG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lEb2N1bWVudCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlbWVudHM6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcImNsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YVwiXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWZmZWN0OiBjZGsuYXdzX2lhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiY2xvdWR3YXRjaDpuYW1lc3BhY2VcIjogXCJBV1MvUUJ1c2luZXNzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICApLFxyXG4gICAgICAgICAgICAgICAgXCJBbWF6b25RQXBwbGljYXRpb25EZXNjcmliZUxvZ0dyb3Vwc1Blcm1pc3Npb25cIjogbmV3IGNkay5hd3NfaWFtLlBvbGljeURvY3VtZW50KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IGNkay5hd3NfaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW1wibG9nczpEZXNjcmliZUxvZ0dyb3Vwc1wiXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWZmZWN0OiBjZGsuYXdzX2lhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgKSxcclxuICAgICAgICAgICAgICAgIFwiQW1hem9uUUFwcGxpY2F0aW9uQ3JlYXRlTG9nR3JvdXBQZXJtaXNzaW9uXCI6IG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lEb2N1bWVudCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlbWVudHM6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcImxvZ3M6Q3JlYXRlTG9nR3JvdXBcIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6bG9nczoke3JlZ2lvbn06JHthd3NBY2NvdW50SWR9OmxvZy1ncm91cDovYXdzL3FidXNpbmVzcy8qYF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWZmZWN0OiBjZGsuYXdzX2lhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgKSxcclxuICAgICAgICAgICAgICAgIFwiQW1hem9uUUFwcGxpY2F0aW9uTG9nU3RyZWFtUGVybWlzc2lvblwiOiBuZXcgY2RrLmF3c19pYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXCJsb2dzOkRlc2NyaWJlTG9nU3RyZWFtc1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nU3RyZWFtXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibG9nczpQdXRMb2dFdmVudHNcIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6bG9nczoke3JlZ2lvbn06JHthd3NBY2NvdW50SWR9OmxvZy1ncm91cDovYXdzL3FidXNpbmVzcy8qOmxvZy1zdHJlYW06KmBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVmZmVjdDogY2RrLmF3c19pYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICksXHJcbiAgICAgICAgICAgICAgICBcIlFCdXNpbmVzc1VzZXJTdWJzY3JpcHRpb25QZXJtaXNzaW9uc1wiOiBuZXcgY2RrLmF3c19pYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicWJ1c2luZXNzOkNyZWF0ZVN1YnNjcmlwdGlvblwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInFidXNpbmVzczpVcGRhdGVTdWJzY3JpcHRpb25cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJxYnVzaW5lc3M6Q2FuY2VsU3Vic2NyaXB0aW9uXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicWJ1c2luZXNzOkxpc3RTdWJzY3JpcHRpb25zXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwidXNlci1zdWJzY3JpcHRpb25zOkNyZWF0ZUNsYWltXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwidXNlci1zdWJzY3JpcHRpb25zOlVwZGF0ZUNsYWltXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwidXNlci1zdWJzY3JpcHRpb25zOkNvbW1pdENsYWltXCJdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOnFidXNpbmVzczoke3JlZ2lvbn06JHthd3NBY2NvdW50SWR9OmFwcGxpY2F0aW9uLypgXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlZmZlY3Q6IGNkay5hd3NfaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICApLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlFCdXNpbmVzc1JvbGVBcm5cIiwge1xyXG4gICAgICAgICAgICB2YWx1ZTogcm9sZS5yb2xlQXJuLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmFwcF9yb2xlID0gcm9sZTtcclxuXHJcbiAgICAgICAgY29uc3Qgd2ViX3JvbGUgPSBuZXcgY2RrLmF3c19pYW0uUm9sZSh0aGlzLCBcIlFJYW1Sb2xlV2ViRXhwXCIsIHtcclxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgY2RrLmF3c19pYW0uU2VydmljZVByaW5jaXBhbChcImFwcGxpY2F0aW9uLnFidXNpbmVzcy5hbWF6b25hd3MuY29tXCIsIHtcclxuICAgICAgICAgICAgICAgIGNvbmRpdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJhd3M6U291cmNlQWNjb3VudFwiOiBhd3NBY2NvdW50SWQsXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgaW5saW5lUG9saWNpZXM6IHtcclxuICAgICAgICAgICAgICAgIFwiUUJ1c2luZXNzQ29udmVyc2F0aW9uUGVybWlzc2lvblwiOiBuZXcgY2RrLmF3c19pYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicWJ1c2luZXNzOkNoYXRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJxYnVzaW5lc3M6Q2hhdFN5bmNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJxYnVzaW5lc3M6TGlzdE1lc3NhZ2VzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicWJ1c2luZXNzOkxpc3RDb252ZXJzYXRpb25zXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicWJ1c2luZXNzOkRlbGV0ZUNvbnZlcnNhdGlvblwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInFidXNpbmVzczpQdXRGZWVkYmFja1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInFidXNpbmVzczpHZXRXZWJFeHBlcmllbmNlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicWJ1c2luZXNzOkdldEFwcGxpY2F0aW9uXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicWJ1c2luZXNzOkxpc3RQbHVnaW5zXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicWJ1c2luZXNzOkdldENoYXRDb250cm9sc0NvbmZpZ3VyYXRpb25cIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6cWJ1c2luZXNzOiR7cmVnaW9ufToke2F3c0FjY291bnRJZH06YXBwbGljYXRpb24vKmBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVmZmVjdDogY2RrLmF3c19pYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICksXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IHdlYl9yb2xlX2NmbiA9IHdlYl9yb2xlLm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIGNkay5hd3NfaWFtLkNmblJvbGU7XHJcbiAgICAgICAgd2ViX3JvbGVfY2ZuLmFzc3VtZVJvbGVQb2xpY3lEb2N1bWVudC5zdGF0ZW1lbnRzWzBdLmFkZEFjdGlvbnMoXCJzdHM6U2V0Q29udGV4dFwiKTtcclxuXHJcblxyXG4gICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiUUJ1c2luZXNzV2ViRXhwUm9sZUFyblwiLCB7XHJcbiAgICAgICAgICAgIHZhbHVlOiB3ZWJfcm9sZS5yb2xlQXJuLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLndlYl9leHBfcm9sZSA9IHdlYl9yb2xlO1xyXG4gICAgfVxyXG59Il19