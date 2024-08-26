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
  public dataSourceId: string;
  public webEndpoint: string;
  public appArn: string;
  
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

    const cdk_app = new cdk.aws_qbusiness.CfnApplication(this, 'QBusinessApp', {
      displayName: props.amazon_q_app_name,
      roleArn: props.amazon_q_app_role_arn,
      attachmentsConfiguration: {
        attachmentsControlMode: "ENABLED",
      },
      identityCenterInstanceArn: props.idcArn,
      description: "Amazon Q Business Application",

    });

    const q_index = new cdk.aws_qbusiness.CfnIndex(this, 'QBusinessIndex', {
      applicationId: cdk_app.ref,
      displayName: `${props.amazon_q_app_name}-index`,
      description: "Amazon Q Business Index",
      capacityConfiguration: {
        units: 1,
      },
      type: "STARTER",
    });

    const indexId = cdk.Fn.select(1, cdk.Fn.split("|", q_index.ref))

    const q_retriever = new cdk.aws_qbusiness.CfnRetriever(this, 'QBusinessRetriever', {
      applicationId: cdk_app.ref,
      displayName: `${props.amazon_q_app_name}-retriever`,
      type: "NATIVE_INDEX",
      configuration: {
        nativeIndexConfiguration: {
          indexId: indexId,
        },
      }
    });

    const q_data_source = new cdk.aws_qbusiness.CfnDataSource(this, 'QBusinessDataSource', {
      applicationId: cdk_app.ref,
      displayName: `${props.amazon_q_app_name}-data-source`,
      indexId: indexId,
      description: "Amazon Q Business Data Source",
      configuration: {
        type: "CUSTOM",
        version: "1.0.0"
      }
    });

    const data_source_id = cdk.Fn.select(1, cdk.Fn.split("|", q_data_source.ref))

    const web_experience = new cdk.aws_qbusiness.CfnWebExperience(this, 'QBusinessWebExperience', {
      applicationId: cdk_app.ref,
      roleArn: props.amazon_q_web_exp_role_arn,
      title: props.amazon_q_app_name,
      welcomeMessage: `Welcome to Amazon Q Business ${props.amazon_q_app_name}!`,
    });

    this.appId = cdk_app.ref;
    this.appArn = cdk_app.attrApplicationArn;
    this.indexId = indexId;
    this.dataSourceId = data_source_id;
    this.webEndpoint = web_experience.attrDefaultEndpoint;
  }
}