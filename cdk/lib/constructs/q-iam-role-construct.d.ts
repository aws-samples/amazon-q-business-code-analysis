import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
export interface QIamRoleProps extends cdk.StackProps {
    readonly roleName: string;
}
export declare class QIamRoleConstruct extends Construct {
    app_role: cdk.aws_iam.Role;
    web_exp_role: cdk.aws_iam.Role;
    constructor(parent: Construct, name: string, props: QIamRoleProps);
}
