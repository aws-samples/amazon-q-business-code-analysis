"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmazonNeptuneConstruct = void 0;
const cdk = require("aws-cdk-lib");
const constructs_1 = require("constructs");
const defaultProps = {};
class AmazonNeptuneConstruct extends constructs_1.Construct {
    constructor(parent, name, props) {
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
exports.AmazonNeptuneConstruct = AmazonNeptuneConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1hem9uLW5lcHR1bmUtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYW1hem9uLW5lcHR1bmUtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQywyQ0FBdUM7QUFNdkMsTUFBTSxZQUFZLEdBQWdDLEVBQUUsQ0FBQztBQUVyRCxNQUFhLHNCQUF1QixTQUFRLHNCQUFTO0lBR2pELFlBQVksTUFBaUIsRUFBRSxJQUFZLEVBQUUsS0FBeUI7UUFDdEUsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVwQixLQUFLLEdBQUcsRUFBRSxHQUFHLFlBQVksRUFBRSxHQUFHLEtBQUssRUFBRSxDQUFDO1FBRXRDLDZCQUE2QjtRQUM3QixNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRTtZQUM3RCxpQkFBaUIsRUFBRSxHQUFHO1lBQ3RCLG9DQUFvQztZQUNwQyxrQkFBa0IsRUFBRSxLQUFLO1lBQ3pCLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxRQUFRLFFBQVE7WUFDcEMsa0JBQWtCLEVBQUUsSUFBSTtZQUN4QixZQUFZLEVBQUUsQ0FBQztZQUNmLHlCQUF5QixFQUFFO2dCQUN6QixxQkFBcUIsRUFBRSxJQUFJO2FBQzVCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsYUFBYTtRQUNiLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ2xDLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVztZQUN4QixXQUFXLEVBQUUsdUNBQXVDO1NBQ3JELENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0lBRXJCLENBQUM7Q0FDRjtBQTlCRCx3REE4QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFtYXpvbk5lcHR1bmVQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICByZWFkb25seSBxQXBwTmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5jb25zdCBkZWZhdWx0UHJvcHM6IFBhcnRpYWw8QW1hem9uTmVwdHVuZVByb3BzPiA9IHt9O1xyXG5cclxuZXhwb3J0IGNsYXNzIEFtYXpvbk5lcHR1bmVDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xyXG4gICAgcHVibGljIGdyYXBoOiBjZGsuYXdzX25lcHR1bmVncmFwaC5DZm5HcmFwaDtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihwYXJlbnQ6IENvbnN0cnVjdCwgbmFtZTogc3RyaW5nLCBwcm9wczogQW1hem9uTmVwdHVuZVByb3BzKSB7XHJcbiAgICBzdXBlcihwYXJlbnQsIG5hbWUpO1xyXG5cclxuICAgIHByb3BzID0geyAuLi5kZWZhdWx0UHJvcHMsIC4uLnByb3BzIH07XHJcblxyXG4gICAgLy8gQVdTIE5lcHR1bmUgR3JhcGggQ2ZuR3JhcGhcclxuICAgIGNvbnN0IGdyYXBoID0gbmV3IGNkay5hd3NfbmVwdHVuZWdyYXBoLkNmbkdyYXBoKHRoaXMsICdHcmFwaCcsIHtcclxuICAgICAgcHJvdmlzaW9uZWRNZW1vcnk6IDEyOCxcclxuICAgICAgLy8gdGhlIHByb3BlcnRpZXMgYmVsb3cgYXJlIG9wdGlvbmFsXHJcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZmFsc2UsXHJcbiAgICAgIGdyYXBoTmFtZTogYCR7cHJvcHMucUFwcE5hbWV9LWdyYXBoYCxcclxuICAgICAgcHVibGljQ29ubmVjdGl2aXR5OiB0cnVlLFxyXG4gICAgICByZXBsaWNhQ291bnQ6IDAsXHJcbiAgICAgIHZlY3RvclNlYXJjaENvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICB2ZWN0b3JTZWFyY2hEaW1lbnNpb246IDE1MzYsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDRk4gb3V0cHV0XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR3JhcGhBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiBncmFwaC5hdHRyR3JhcGhJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdUaGUgaWQgb2YgdGhlIE5lcHR1bmUgQW5hbHl0aWNzIEdyYXBoJyxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuZ3JhcGggPSBncmFwaDtcclxuXHJcbiAgfVxyXG59Il19