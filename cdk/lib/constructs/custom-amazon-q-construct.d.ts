import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
export interface CustomResourceProps extends cdk.StackProps {
    readonly amazon_q_app_name: string;
    readonly amazon_q_app_role_arn: string;
    readonly amazon_q_web_exp_role_arn: string;
    readonly boto3Layer: cdk.aws_lambda.LayerVersion;
    readonly idcArn: string;
}
export declare class CustomQBusinessConstruct extends Construct {
    appId: string;
    indexId: string;
    dataSourceId: string;
    webEndpoint: string;
    appArn: string;
    constructor(scope: Construct, name: string, props: CustomResourceProps);
}
