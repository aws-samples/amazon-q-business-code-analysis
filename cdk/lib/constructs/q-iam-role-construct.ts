import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";

export interface QIamRoleProps extends cdk.StackProps {
    readonly roleName: string;
}

const defaultProps: Partial<QIamRoleProps> = {};

export class QIamRoleConstruct extends Construct {
    public app_role: cdk.aws_iam.Role;
    public web_exp_role: cdk.aws_iam.Role;

    constructor(parent: Construct, name: string, props: QIamRoleProps) {
        super(parent, name);

        props = {...defaultProps, ...props};

        const region = cdk.Stack.of(this).region
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
                    },
                ),
                "AmazonQApplicationDescribeLogGroupsPermission": new cdk.aws_iam.PolicyDocument({
                        statements: [
                            new cdk.aws_iam.PolicyStatement({
                                actions: ["logs:DescribeLogGroups"],
                                resources: ["*"],
                                effect: cdk.aws_iam.Effect.ALLOW,
                            }),
                        ],
                    },
                ),
                "AmazonQApplicationCreateLogGroupPermission": new cdk.aws_iam.PolicyDocument({
                        statements: [
                            new cdk.aws_iam.PolicyStatement({
                                actions: ["logs:CreateLogGroup"],
                                resources: [`arn:aws:logs:${region}:${awsAccountId}:log-group:/aws/qbusiness/*`],
                                effect: cdk.aws_iam.Effect.ALLOW,
                            }),
                        ],
                    },
                ),
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
                    },
                ),
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
                                    "user-subscriptions:CommitClaim"],
                                resources: [`arn:aws:qbusiness:${region}:${awsAccountId}:application/*`],
                                effect: cdk.aws_iam.Effect.ALLOW,
                            }),
                        ],
                    },
                ),
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
                                    "qbusiness:GetChatControlsConfiguration"],
                                resources: [`arn:aws:qbusiness:${region}:${awsAccountId}:application/*`],
                                effect: cdk.aws_iam.Effect.ALLOW,
                            }),
                        ],
                    },
                ),
            },
        });

        const web_role_cfn = web_role.node.findChild('Resource') as cdk.aws_iam.CfnRole;
        web_role_cfn.assumeRolePolicyDocument.statements[0].addActions("sts:SetContext");


        new cdk.CfnOutput(this, "QBusinessWebExpRoleArn", {
            value: web_role.roleArn,
        });

        this.web_exp_role = web_role;
    }
}