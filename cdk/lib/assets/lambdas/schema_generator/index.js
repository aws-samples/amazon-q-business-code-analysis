// V3 AWS SDK
// S3 client from @aws-sdk/client-s3

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { QBusinessClient, CreatePluginCommand } = require('@aws-sdk/client-qbusiness');

exports.handler = async (event) => {
  const apiId = process.env.API_ID;
  const stageName = process.env.STAGE_NAME;
  const region = process.env.AWS_REGION;
  const authUrl = process.env.AUTH_URL;
  const tokenUrl = process.env.TOKEN_URL;
  const secretRoleArn = process.env.SECRET_ROLE_ARN;
  const secretArn = process.env.SECRET_ARN;
  const bucketName = process.env.BUCKET_NAME;
  const appId = process.env.APP_ID;

  const openApiSchema = {
    openapi: '3.0.3',
    info: {
      title: 'Agent Goal API',
      version: '1.0.0',
    },
    servers: [
      {
        url: `https://${apiId}.execute-api.${region}.amazonaws.com/${stageName}/`,
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
              authorizationUrl: `${authUrl}`,
              tokenUrl: `${tokenUrl}`,
              scopes: {
                "repository/write": "Write access to protected resources"
              },
            },
          },
        },
      },
    },
    security: [
      {
        oauth2: [
          "repository/write"
        ]
      }
    ]
  };

  try {
    const s3Client = new S3Client({ region });
    const putObjectParams = {
      Bucket: bucketName,
      Key: 'openapi-schema.json',
      Body: JSON.stringify(openApiSchema),
    };
    await s3Client.send(new PutObjectCommand(putObjectParams));

    console.log('OpenAPI schema uploaded successfully');
    var uniqueId;
    if (event.PhysicalResourceId) {
      uniqueId = event.PhysicalResourceId;
    }
    else{
      uniqueId = Math.random().toString(36).substring(7);
    }
    
    const qClient = new QBusinessClient({ region });
    const input = {
        applicationId: appId,
        authConfiguration: {
            oAuth2ClientCredentialConfiguration: {
                roleArn: secretRoleArn,
                secretArn: secretArn,
            },
        },
        displayName: 'ResearchAgent',
        type: 'CUSTOM',
        customPluginConfiguration: {
            apiSchema: { s3: {
                bucket: bucketName,
                key: 'openapi-schema.json',
            } },
            apiSchemaType: 'OPEN_API_V3',
            description: 'Custom Plugin Description',
        },
    }
    const command = new CreatePluginCommand(input);
    const response = await qClient.send(command);

    return {
      Status: 'SUCCESS',
      PhysicalResourceId: uniqueId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: {
        Message: 'OpenAPI schema generated and uploaded successfully'
      }
    };
    
  } catch (error) {
    var uniqueId;
    if (event.PhysicalResourceId) {
      uniqueId = event.PhysicalResourceId;
    }
    else{
      uniqueId = Math.random().toString(36).substring(7);
    }
    console.error('Error:', error);
    return {
      Status: 'FAILED',
      PhysicalResourceId: uniqueId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Reason: `Error generating or uploading OpenAPI schema: ${error.message}`
    };
  }
};