import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface CustomResourceProps extends cdk.StackProps {
  readonly amazon_q_app_name: string;
  readonly amazon_q_app_role_arn: string;
  readonly amazon_q_web_exp_role_arn: string;
  readonly boto3Layer: cdk.aws_lambda.LayerVersion;
  readonly idcArn: string;
}

const defaultProps: Partial<CustomResourceProps> = {};


export class CustomQBusinessConstruct extends Construct {
  public appId: string;
  public indexId: string;

  constructor(scope: Construct, name: string, props: CustomResourceProps) {
    super(scope, name);

    props = { ...defaultProps, ...props };

    const awsAccountId = cdk.Stack.of(this).account;

    const qBusinessCustomResourceRole = new cdk.aws_iam.Role(this, 'QBusinessCustomLambdaRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    qBusinessCustomResourceRole.addManagedPolicy(cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));

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
        "qbusiness:CreateWebExperience",
        "qbusiness:DeleteWebExperience",
      ],
      resources: [
        `arn:aws:qbusiness:${cdk.Stack.of(this).region}:${awsAccountId}:application/*`,
      ],
    }));

    qBusinessCustomResourceRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        "sso:CreateApplication",
        "sso:PutApplicationGrant",
        "sso:UpdateApplication",
      ],
      resources: [
        '*',
      ],
    }));


    // Add IAM pass role permissions
    qBusinessCustomResourceRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        "iam:PassRole",
      ],
      resources: [props.amazon_q_app_role_arn, props.amazon_q_web_exp_role_arn],
    }));

    const powertools_layer = cdk.aws_lambda.LayerVersion.fromLayerVersionArn(
        this,
        'AwsLambdaPowerToolsLayer',
        `arn:aws:lambda:${cdk.Stack.of(this).region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:29`
    )

    const onEvent = new cdk.aws_lambda.Function(this, 'QBusinessCreateDeleteAppFunction', {
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_12,
      handler: 'amazon_q_app_resource.on_event',
      code: cdk.aws_lambda.Code.fromAsset("lib/assets/lambdas/amazon_q_app"),
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      layers: [props.boto3Layer, powertools_layer],
      timeout: cdk.Duration.seconds(600),
      environment: {
        Q_APP_NAME: props.amazon_q_app_name,
        Q_APP_ROLE_ARN: props.amazon_q_app_role_arn,
        Q_WEB_EXP_ROLE_ARN: props.amazon_q_web_exp_role_arn,
        IDC_ARN: props.idcArn,
        POWERTOOLS_SERVICE_NAME: "amazon_q_app_custom_resource",
        LOG_LEVEL: "INFO"
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

    this.appId = customResource.getAttString('AmazonQAppId')
    this.indexId = customResource.getAttString('AmazonQIndexId')


    new cdk.CfnOutput(this, "QBusinessAppFunctionArn", {
      value: onEvent.functionArn,
    });

  }
}