import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { aws_qbusiness as qbusiness } from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface AmazonQPluginStackProps extends cdk.StackProps {
    appId: string,
    secretAccessRole: iam.Role,
    secret: secretsmanager.Secret,
    apiUrl: string,
    cognitoDomain: string
}

export class AmazonQPluginConstruct extends Construct {
    constructor(scope: Construct, id: string, props: AmazonQPluginStackProps) {
        super(scope, id);
       
        const openApiSchema = {
            openapi: '3.0.3',
            info: {
              title: 'Agent Goal API',
              version: '1.0.0',
            },
            servers: [
              {
                url: `${props.apiUrl}`,
              },
            ],
            paths: {
              '/agent-goal': {
                post: {
                  operationId: 'setAgentGoal',
                  description: 'Set a goal for an agent to attempt to accomplish.',
                  requestBody: {
                    required: true,
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            goal: {
                              type: 'string',
                              description: 'The goal that the agent will attempt to accomplish.',
                            },
                          },
                          required: ['goal'],
                        },
                      },
                    },
                  },
                  responses: {
                    '200': {
                      description: 'Successful response',
                      content: {
                        'application/json': {
                          schema: {
                            type: 'object',
                            properties: {
                              message: {
                                type: 'string',
                                description: 'A message indicating the result of setting the agent\'s goal.',
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            components: {
              securitySchemes: {
                oauth2: {
                  type: 'oauth2',
                  flows: {
                    authorizationCode: {
                      authorizationUrl: `${props.cognitoDomain}/oauth2/authorize`,
                      tokenUrl: `${props.cognitoDomain}/oauth2/token`,
                      scopes: {
                        "agent/write": "Write access to protected resources"
                      },
                    },
                  },
                },
              },
            },
            security: [
              {
                oauth2: [
                  "agent/write"
                ]
              }
            ]
          };

          
        const cfnPlugin = new qbusiness.CfnPlugin(this, 'AgentPlugin', {
            applicationId: props.appId,
            authConfiguration: {
                oAuth2ClientCredentialConfiguration: {
                    roleArn: props.secretAccessRole.roleArn,
                    secretArn: props.secret.secretArn,
                },
            },
            displayName: 'AgentPlugin',
            type: 'CUSTOM',
            customPluginConfiguration: {
              apiSchema: { payload: JSON.stringify(openApiSchema) },
              apiSchemaType: 'OPEN_API_V3',
              description: 'Agent plugin',
          },
        });
    }
}