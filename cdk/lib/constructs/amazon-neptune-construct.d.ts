import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
export interface AmazonNeptuneProps extends cdk.StackProps {
    readonly qAppName: string;
}
export declare class AmazonNeptuneConstruct extends Construct {
    graph: cdk.aws_neptunegraph.CfnGraph;
    constructor(parent: Construct, name: string, props: AmazonNeptuneProps);
}
