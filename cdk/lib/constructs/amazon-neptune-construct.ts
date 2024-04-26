import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface AmazonNeptuneProps extends cdk.StackProps {
  readonly qAppName: string;
}

const defaultProps: Partial<AmazonNeptuneProps> = {};

export class AmazonNeptuneConstruct extends Construct {
    public graph: cdk.aws_neptunegraph.CfnGraph;

    constructor(parent: Construct, name: string, props: AmazonNeptuneProps) {
    super(parent, name);

    props = { ...defaultProps, ...props };

    // AWS Neptune Graph CfnGraph
    const graph = new cdk.aws_neptunegraph.CfnGraph(this, 'Graph', {
      provisionedMemory: 128,
      // the properties below are optional
      deletionProtection: false,
      graphName: `${props.qAppName}-graph`,
      publicConnectivity: true,
      replicaCount: 0,
      vectorSearchConfiguration: {
        vectorSearchDimension: 1536,
      },
    });

    // CFN output
    new cdk.CfnOutput(this, 'GraphArn', {
      value: graph.attrGraphId,
      description: 'The id of the Neptune Analytics Graph',
    });

    this.graph = graph;

  }
}