import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface QIamRoleProps extends cdk.StackProps {
  readonly roleName: string;
}

const defaultProps: Partial<QIamRoleProps> = {};

export class QIamRoleConstruct extends Construct {
    public role: cdk.aws_iam.Role;

    constructor(parent: Construct, name: string, props: QIamRoleProps) {
    super(parent, name);

    props = { ...defaultProps, ...props };

    const role = new cdk.aws_iam.Role(this, "Role", {
      roleName: props.roleName,
      assumedBy: new cdk.aws_iam.ServicePrincipal("qbusiness.amazonaws.com"),
      inlinePolicies: {
        "AmazonQApplicationPutMetricDataPermission": new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: ["cloudwatch:PutMetricData"],
              resources: ["*"],
              effect: cdk.aws_iam.Effect.ALLOW,
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
                resources: ["arn:aws:logs:us-east-1:*:log-group:/aws/qbusiness/*"],
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
                resources: ["arn:aws:logs:us-east-1:*:log-group:/aws/qbusiness/*:log-stream:*"],
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

    this.role = role;
  }
}