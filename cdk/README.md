# Welcome to the CDK TypeScript for Q Business Code Analysis

This project deploys the resources needed to set up the Q Business Code Analysis sample.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Getting started

## Prerequisites
[Configure your AWS Credentials](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html)
[CDK bootstrap](https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html) run `npm i -g cdk && npx cdk bootstrap`


## Install dependencies 

Write the following commands in the terminal to get started with the project.

```bash
npm install
```

## Deploying the stack
To deploy the stack, run the following command. Replace the `RepositoryUrl`, `ProjectName`, and `IdcArn` parameters with the values you want to use:
Identity Center is now required to create Amazon Q for Business and you must enable it on your account or use an existing one from your organization. After you create the Identity Center, you can find the ARN under Settings in the AWS Console under IAM Identity Center.

```bash
npx cdk deploy --parameters RepositoryUrl=<repository_git_url> --parameters ProjectName=<project_name> --parameters IdcArn=<identity_center_arn> --require-approval never
```

For example:

```bash
npx cdk deploy --parameters RepositoryUrl=https://github.com/aws-samples/langchain-agents.git --parameters ProjectName=Langchain-Agents --parameters IdcArn=arn:aws:sso:::instance/ssoins-xxxxxxxxxxxxxxx --require-approval never
```

## Accessing Private repositories
To access a private repository you will need to generate an SSH key and upload the private key to Secrets Manager and the public key to your git provider. Then just pass the ssh url and ssh secret name as parameters. Currently supported with cdk deployments, i.e.  For Github you can generate an SSH key by following the instructions [here](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent).

```bash
npx cdk deploy --parameters ProjectName=Langchain-Agents --parameters RepositoryUrl=https://github.com/aws-samples/langchain-agents.git --parameters ProjectName=Langchain-Agents --parameters IdcArn=IdcArn=arn:aws:sso:::instance/ssoins-xxxxxxxxxxxxxxx --parameters SshUrl=git@github.com:aws-samples/langchain-agents.git --parameters SshSecretName=<your_ssh_secret_name> --require-approval never 
```

## Destroying the stack
To destroy the stack, run the following command:

```bash
npx cdk destroy
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
