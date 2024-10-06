"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomQBusinessConstruct = void 0;
const cdk = require("aws-cdk-lib");
const constructs_1 = require("constructs");
const defaultProps = {};
class CustomQBusinessConstruct extends constructs_1.Construct {
    constructor(scope, name, props) {
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
        const indexId = cdk.Fn.select(1, cdk.Fn.split("|", q_index.ref));
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
        const data_source_id = cdk.Fn.select(1, cdk.Fn.split("|", q_data_source.ref));
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
exports.CustomQBusinessConstruct = CustomQBusinessConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VzdG9tLWFtYXpvbi1xLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImN1c3RvbS1hbWF6b24tcS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLDJDQUF1QztBQVV2QyxNQUFNLFlBQVksR0FBaUMsRUFBRSxDQUFDO0FBR3RELE1BQWEsd0JBQXlCLFNBQVEsc0JBQVM7SUFPckQsWUFBWSxLQUFnQixFQUFFLElBQVksRUFBRSxLQUEwQjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRW5CLEtBQUssR0FBRyxFQUFFLEdBQUcsWUFBWSxFQUFFLEdBQUcsS0FBSyxFQUFFLENBQUM7UUFFdEMsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDO1FBRWhELE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDMUYsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztTQUNwRSxDQUFDLENBQUM7UUFFSCwyQkFBMkIsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDLENBQUM7UUFFN0ksMkJBQTJCLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUM7WUFDdEUsT0FBTyxFQUFFO2dCQUNQLDZCQUE2QjtnQkFDN0IsNkJBQTZCO2dCQUM3QiwwQkFBMEI7Z0JBQzFCLHVCQUF1QjtnQkFDdkIsdUJBQXVCO2dCQUN2QixvQkFBb0I7Z0JBQ3BCLDJCQUEyQjtnQkFDM0IsMkJBQTJCO2dCQUMzQix3QkFBd0I7Z0JBQ3hCLCtC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QUFHLENBQUMsQ0FBQyxDQUFBO1FBRTdFLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDNUYsYUFBYSxFQUFFLE9BQU8sQ0FBQyxHQUFHO1lBQzFCLE9BQU8sRUFBRSxLQUFLLENBQUMseUJBQXlCO1lBQ3hDLEtBQUssRUFBRSxLQUFLLENBQUMsaUJBQWlCO1lBQzlCLGNBQWMsRUFBRSxnQ0FBZ0MsS0FBSyxDQUFDLGlCQUFpQixHQUFHO1NBQzNFLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQztRQUN6QixJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQztRQUN6QyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLGNBQWMsQ0FBQztRQUNuQyxJQUFJLENBQUMsV0FBVyxHQUFHLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQztJQUN4RCxDQUFDO0NBQ0Y7QUF2SEQsNERBdUhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDdXN0b21SZXNvdXJjZVByb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIHJlYWRvbmx5IGFtYXpvbl9xX2FwcF9uYW1lOiBzdHJpbmc7XHJcbiAgcmVhZG9ubHkgYW1hem9uX3FfYXBwX3JvbGVfYXJuOiBzdHJpbmc7XHJcbiAgcmVhZG9ubHkgYW1hem9uX3Ffd2ViX2V4cF9yb2xlX2Fybjogc3RyaW5nO1xyXG4gIHJlYWRvbmx5IGJvdG8zTGF5ZXI6IGNkay5hd3NfbGFtYmRhLkxheWVyVmVyc2lvbjtcclxuICByZWFkb25seSBpZGNBcm46IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgZGVmYXVsdFByb3BzOiBQYXJ0aWFsPEN1c3RvbVJlc291cmNlUHJvcHM+ID0ge307XHJcblxyXG5cclxuZXhwb3J0IGNsYXNzIEN1c3RvbVFCdXNpbmVzc0NvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XHJcbiAgcHVibGljIGFwcElkOiBzdHJpbmc7XHJcbiAgcHVibGljIGluZGV4SWQ6IHN0cmluZztcclxuICBwdWJsaWMgZGF0YVNvdXJjZUlkOiBzdHJpbmc7XHJcbiAgcHVibGljIHdlYkVuZHBvaW50OiBzdHJpbmc7XHJcbiAgcHVibGljIGFwcEFybjogc3RyaW5nO1xyXG4gIFxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIG5hbWU6IHN0cmluZywgcHJvcHM6IEN1c3RvbVJlc291cmNlUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBuYW1lKTtcclxuXHJcbiAgICBwcm9wcyA9IHsgLi4uZGVmYXVsdFByb3BzLCAuLi5wcm9wcyB9O1xyXG5cclxuICAgIGNvbnN0IGF3c0FjY291bnRJZCA9IGNkay5TdGFjay5vZih0aGlzKS5hY2NvdW50O1xyXG5cclxuICAgIGNvbnN0IHFCdXNpbmVzc0N1c3RvbVJlc291cmNlUm9sZSA9IG5ldyBjZGsuYXdzX2lhbS5Sb2xlKHRoaXMsICdRQnVzaW5lc3NDdXN0b21MYW1iZGFSb2xlJywge1xyXG4gICAgICBhc3N1bWVkQnk6IG5ldyBjZGsuYXdzX2lhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgcUJ1c2luZXNzQ3VzdG9tUmVzb3VyY2VSb2xlLmFkZE1hbmFnZWRQb2xpY3koY2RrLmF3c19pYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCIpKTtcclxuXHJcbiAgICBxQnVzaW5lc3NDdXN0b21SZXNvdXJjZVJvbGUuYWRkVG9Qb2xpY3kobmV3IGNkay5hd3NfaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICBcInFidXNpbmVzczpDcmVhdGVBcHBsaWNhdGlvblwiLFxyXG4gICAgICAgIFwicWJ1c2luZXNzOkRlbGV0ZUFwcGxpY2F0aW9uXCIsXHJcbiAgICAgICAgXCJxYnVzaW5lc3M6R2V0QXBwbGljYXRpb25cIixcclxuICAgICAgICBcInFidXNpbmVzczpDcmVhdGVJbmRleFwiLFxyXG4gICAgICAgIFwicWJ1c2luZXNzOkRlbGV0ZUluZGV4XCIsXHJcbiAgICAgICAgXCJxYnVzaW5lc3M6R2V0SW5kZXhcIixcclxuICAgICAgICBcInFidXNpbmVzczpDcmVhdGVSZXRyaWV2ZXJcIixcclxuICAgICAgICBcInFidXNpbmVzczpEZWxldGVSZXRyaWV2ZXJcIixcclxuICAgICAgICBcInFidXNpbmVzczpHZXRSZXRyaWV2ZXJcIixcclxuICAgICAgICBcInFidXNpbmVzczpDcmVhdGVXZWJFeHBlcmllbmNlXCIsXHJcbiAgICAgICAgXCJxYnVzaW5lc3M6RGVsZXRlV2ViRXhwZXJpZW5jZVwiLFxyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICBgYXJuOmF3czpxYnVzaW5lc3M6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2F3c0FjY291bnRJZH06YXBwbGljYXRpb24vKmAsXHJcbiAgICAgIF0sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgcUJ1c2luZXNzQ3VzdG9tUmVzb3VyY2VSb2xlLmFkZFRvUG9saWN5KG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgXCJzc286Q3JlYXRlQXBwbGljYXRpb25cIixcclxuICAgICAgICBcInNzbzpQdXRBcHBsaWNhdGlvbkdyYW50XCIsXHJcbiAgICAgICAgXCJzc286VXBkYXRlQXBwbGljYXRpb25cIixcclxuICAgICAgXSxcclxuICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgJyonLFxyXG4gICAgICBdLFxyXG4gICAgfSkpO1xyXG5cclxuXHJcbiAgICAvLyBBZGQgSUFNIHBhc3Mgcm9sZSBwZXJtaXNzaW9uc1xyXG4gICAgcUJ1c2luZXNzQ3VzdG9tUmVzb3VyY2VSb2xlLmFkZFRvUG9saWN5KG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgXCJpYW06UGFzc1JvbGVcIixcclxuICAgICAgXSxcclxuICAgICAgcmVzb3VyY2VzOiBbcHJvcHMuYW1hem9uX3FfYXBwX3JvbGVfYXJuLCBwcm9wcy5hbWF6b25fcV93ZWJfZXhwX3JvbGVfYXJuXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICBjb25zdCBjZGtfYXBwID0gbmV3IGNkay5hd3NfcWJ1c2luZXNzLkNmbkFwcGxpY2F0aW9uKHRoaXMsICdRQnVzaW5lc3NBcHAnLCB7XHJcbiAgICAgIGRpc3BsYXlOYW1lOiBwcm9wcy5hbWF6b25fcV9hcHBfbmFtZSxcclxuICAgICAgcm9sZUFybjogcHJvcHMuYW1hem9uX3FfYXBwX3JvbGVfYXJuLFxyXG4gICAgICBhdHRhY2htZW50c0NvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICBhdHRhY2htZW50c0NvbnRyb2xNb2RlOiBcIkVOQUJMRURcIixcclxuICAgICAgfSxcclxuICAgICAgaWRlbnRpdHlDZW50ZXJJbnN0YW5jZUFybjogcHJvcHMuaWRjQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJBbWF6b24gUSBCdXNpbmVzcyBBcHBsaWNhdGlvblwiLFxyXG5cclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHFfaW5kZXggPSBuZXcgY2RrLmF3c19xYnVzaW5lc3MuQ2ZuSW5kZXgodGhpcywgJ1FCdXNpbmVzc0luZGV4Jywge1xyXG4gICAgICBhcHBsaWNhdGlvbklkOiBjZGtfYXBwLnJlZixcclxuICAgICAgZGlzcGxheU5hbWU6IGAke3Byb3BzLmFtYXpvbl9xX2FwcF9uYW1lfS1pbmRleGAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkFtYXpvbiBRIEJ1c2luZXNzIEluZGV4XCIsXHJcbiAgICAgIGNhcGFjaXR5Q29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgIHVuaXRzOiAxLFxyXG4gICAgICB9LFxyXG4gICAgICB0eXBlOiBcIlNUQVJURVJcIixcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGluZGV4SWQgPSBjZGsuRm4uc2VsZWN0KDEsIGNkay5Gbi5zcGxpdChcInxcIiwgcV9pbmRleC5yZWYpKVxyXG5cclxuICAgIGNvbnN0IHFfcmV0cmlldmVyID0gbmV3IGNkay5hd3NfcWJ1c2luZXNzLkNmblJldHJpZXZlcih0aGlzLCAnUUJ1c2luZXNzUmV0cmlldmVyJywge1xyXG4gICAgICBhcHBsaWNhdGlvbklkOiBjZGtfYXBwLnJlZixcclxuICAgICAgZGlzcGxheU5hbWU6IGAke3Byb3BzLmFtYXpvbl9xX2FwcF9uYW1lfS1yZXRyaWV2ZXJgLFxyXG4gICAgICB0eXBlOiBcIk5BVElWRV9JTkRFWFwiLFxyXG4gICAgICBjb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgbmF0aXZlSW5kZXhDb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgICBpbmRleElkOiBpbmRleElkLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHFfZGF0YV9zb3VyY2UgPSBuZXcgY2RrLmF3c19xYnVzaW5lc3MuQ2ZuRGF0YVNvdXJjZSh0aGlzLCAnUUJ1c2luZXNzRGF0YVNvdXJjZScsIHtcclxuICAgICAgYXBwbGljYXRpb25JZDogY2RrX2FwcC5yZWYsXHJcbiAgICAgIGRpc3BsYXlOYW1lOiBgJHtwcm9wcy5hbWF6b25fcV9hcHBfbmFtZX0tZGF0YS1zb3VyY2VgLFxyXG4gICAgICBpbmRleElkOiBpbmRleElkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJBbWF6b24gUSBCdXNpbmVzcyBEYXRhIFNvdXJjZVwiLFxyXG4gICAgICBjb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgdHlwZTogXCJDVVNUT01cIixcclxuICAgICAgICB2ZXJzaW9uOiBcIjEuMC4wXCJcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZGF0YV9zb3VyY2VfaWQgPSBjZGsuRm4uc2VsZWN0KDEsIGNkay5Gbi5zcGxpdChcInxcIiwgcV9kYXRhX3NvdXJjZS5yZWYpKVxyXG5cclxuICAgIGNvbnN0IHdlYl9leHBlcmllbmNlID0gbmV3IGNkay5hd3NfcWJ1c2luZXNzLkNmbldlYkV4cGVyaWVuY2UodGhpcywgJ1FCdXNpbmVzc1dlYkV4cGVyaWVuY2UnLCB7XHJcbiAgICAgIGFwcGxpY2F0aW9uSWQ6IGNka19hcHAucmVmLFxyXG4gICAgICByb2xlQXJuOiBwcm9wcy5hbWF6b25fcV93ZWJfZXhwX3JvbGVfYXJuLFxyXG4gICAgICB0aXRsZTogcHJvcHMuYW1hem9uX3FfYXBwX25hbWUsXHJcbiAgICAgIHdlbGNvbWVNZXNzYWdlOiBgV2VsY29tZSB0byBBbWF6b24gUSBCdXNpbmVzcyAke3Byb3BzLmFtYXpvbl9xX2FwcF9uYW1lfSFgLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hcHBJZCA9IGNka19hcHAucmVmO1xyXG4gICAgdGhpcy5hcHBBcm4gPSBjZGtfYXBwLmF0dHJBcHBsaWNhdGlvbkFybjtcclxuICAgIHRoaXMuaW5kZXhJZCA9IGluZGV4SWQ7XHJcbiAgICB0aGlzLmRhdGFTb3VyY2VJZCA9IGRhdGFfc291cmNlX2lkO1xyXG4gICAgdGhpcy53ZWJFbmRwb2ludCA9IHdlYl9leHBlcmllbmNlLmF0dHJEZWZhdWx0RW5kcG9pbnQ7XHJcbiAgfVxyXG59Il19