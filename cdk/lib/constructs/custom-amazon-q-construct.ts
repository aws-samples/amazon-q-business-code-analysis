import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface CustomResourceProps extends cdk.StackProps {
  readonly amazon_q_app_name: string;
  readonly amazon_q_app_role_arn: string;
  readonly boto3Layer: cdk.aws_lambda.LayerVersion;
}

const defaultProps: Partial<CustomResourceProps> = {};


export class CustomQBusinessConstruct extends Construct {

    constructor(scope: Construct, name: string, props: CustomResourceProps) {
      super(scope, name);
  
      props = { ...defaultProps, ...props };
  
      const awsAccountId = cdk.Stack.of(this).account;
  
      const qBusinessCustomResourceRole = new cdk.aws_iam.Role(this, 'QBusinessCustomLambdaRole', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      });

      qBusinessCustomResourceRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "qbusiness:CreateApplication",
          "qbusiness:DeleteApplication",
          "qbusiness:GetApplication",
          "qbusiness:CreateIndex",
          "qbusiness:DeleteIndex",
          "qbusiness:GetIndex",
          "qbusiness:CreateRetriever",
          "qbusiness:DeleteRetriever",
          "qbusiness:GetRetriever",
        ],
        resources: [
          `arn:aws:qbusiness:${cdk.Stack.of(this).region}:${awsAccountId}:application/*`,
      ],
      }));

      // Add IAM pass role permissions
      qBusinessCustomResourceRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
        actions: [
          "iam:PassRole",
        ],
        resources: [props.amazon_q_app_role_arn],
      }));
  
      const onEvent = new cdk.aws_lambda.Function(this, 'QBusinessCreateDeleteAppFunction', {
        runtime: cdk.aws_lambda.Runtime.PYTHON_3_12,
        handler: 'amazon_q_app_resource.on_event',
        code: cdk.aws_lambda.Code.fromAsset("lib/assets/lambdas/amazon_q_app"),
        architecture: cdk.aws_lambda.Architecture.ARM_64,
        layers: [props.boto3Layer],
        timeout: cdk.Duration.seconds(600),
        environment: {
          Q_APP_NAME: props.amazon_q_app_name,
          Q_APP_ROLE_ARN: props.amazon_q_app_role_arn,
        },
        role: qBusinessCustomResourceRole
      });

      const qBusinessCustomResourceProvider = new cdk.custom_resources.Provider(this, 'QBusinessHandleAppChanges', {
        onEventHandler: onEvent,
        logRetention: cdk.aws_logs.RetentionDays.ONE_DAY
      });
  
      const customResource = new cdk.CustomResource(this, 'QBusinessAppCfnHook', {
        serviceToken: qBusinessCustomResourceProvider.serviceToken
      });
      
      new cdk.CfnOutput(this, "QBusinessAppFunctionArn", {
        value: onEvent.functionArn,
      });

    }
}