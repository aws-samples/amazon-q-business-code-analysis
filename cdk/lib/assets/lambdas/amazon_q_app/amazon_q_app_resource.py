import boto3
import os
import time
import json
import datetime

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

amazon_q = boto3.client('qbusiness')

@logger.inject_lambda_context(log_event=True)
def on_event(event, context):
    q_app_name = os.environ['Q_APP_NAME']
    logger.append_keys(q_app_name=q_app_name)
    q_app_role_arn = os.environ['Q_APP_ROLE_ARN']
    q_web_exp_role_arn = os.environ['Q_WEB_EXP_ROLE_ARN']
    idc_arn = os.environ['IDC_ARN']
    request_type = event.get('RequestType')
    physical_id = event.get('PhysicalResourceId')
    logger.append_keys(q_app_id=physical_id)

    if request_type == 'Create':
        return on_create(event,
                          q_app_name=q_app_name,
                          q_app_role_arn=q_app_role_arn,
                          q_web_exp_role_arn=q_web_exp_role_arn,
                          idc_arn=idc_arn
                          )
    elif request_type == 'Update':
        return on_update(event, physical_id=physical_id)
    elif request_type == 'Delete':
        return on_delete(event, physical_id=physical_id)
    else:
        raise ValueError("Invalid request type: %s" % request_type)


def on_create(event, q_app_name, q_app_role_arn, q_web_exp_role_arn, idc_arn):
    props = event["ResourceProperties"]
    logger.info("create new resource with props", extra={"props": props})

    try:
        # Create Amazon Q App
        amazon_q_app_id = create_q_app(q_app_name=q_app_name,
                                       role_arn=q_app_role_arn,
                                       idc_arn=idc_arn
                                       )
        logger.append_keys(q_app_id=amazon_q_app_id)
        # Create Q Index
        amazon_q_index_id = create_q_index(q_app_name=q_app_name,
                                           amazon_q_app_id=amazon_q_app_id)

        # Create Q Retriever
        amazon_q_retriever_id = create_q_retriever(
            q_app_name=q_app_name,
            amazon_q_app_id=amazon_q_app_id,
            amazon_q_index_id=amazon_q_index_id,
            q_app_role_arn=q_app_role_arn,
        )

        web_experience_id = create_q_web_experience(amazon_q_app_id=amazon_q_app_id, q_app_name=q_app_name, q_web_exp_role_arn=q_web_exp_role_arn)

        return {
            'PhysicalResourceId': amazon_q_app_id,
            'Data': {
                'AmazonQAppId': amazon_q_app_id,
                'AmazonQIndexId': amazon_q_index_id,
                'AmazonQRetrieverId': amazon_q_retriever_id,
                'AmazonQWebExperienceId': web_experience_id
            }
        }
    except Exception as e:
        logger.exception("Error creating Q App")
        if amazon_q_app_id:
            delete_amazon_q_app(q_app_id=amazon_q_app_id)
        raise RuntimeError("Error creating Q App") from e


def on_update(event, physical_id):
    props = event["ResourceProperties"]
    logger.info("update resource with props", extra={"props": props})

    return {'PhysicalResourceId': physical_id}


def on_delete(event, physical_id):
    delete_amazon_q_app(q_app_id=physical_id)

    return {'PhysicalResourceId': physical_id}


def create_q_app(q_app_name, role_arn, idc_arn):
    import datetime
    response = amazon_q.create_application(
        attachmentsConfiguration={
            'attachmentsControlMode': 'ENABLED'
        },
        displayName=q_app_name,
        description=f"{q_app_name} created with Cloudformation on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        roleArn=role_arn,
        identityCenterInstanceArn=idc_arn
    )
    logger.info("create_application response", extra={"response": response})
    amazon_q_app_id = response["applicationId"]

    return amazon_q_app_id


def create_q_index(q_app_name, amazon_q_app_id):
    response = amazon_q.create_index(
        applicationId=amazon_q_app_id,
        capacityConfiguration={
            'units': 1
        },
        description=f"{q_app_name}-{datetime.datetime.now().strftime('%Y-%m-%d')}",
        displayName=q_app_name,
        type='STARTER',
    )
    index_id = response["indexId"]
    logger.info("create_q_index response", extra={"response": response})
    status = 'CREATING'
    # Wait until index is active
    while status == 'CREATING':
        response = amazon_q.get_index(
            applicationId=amazon_q_app_id,
            indexId=index_id,
        )
        status = response.get('status')
        logger.info(f"Create index status {status}")
        if status  == 'FAILED':
            logger.error("get_index response", extra={"response": response})
            raise RuntimeError("Error creating Q Index: " + response.error)
        time.sleep(10)

    return index_id


def create_q_retriever(q_app_name, amazon_q_app_id, amazon_q_index_id, q_app_role_arn):
    response = amazon_q.create_retriever(
        applicationId=amazon_q_app_id,
        configuration={
            'nativeIndexConfiguration': {
                'indexId': amazon_q_index_id
            }
        },
        displayName=q_app_name,
        roleArn=q_app_role_arn,
        type='NATIVE_INDEX'
    )
    logger.info("create_retriever response", extra={"response": response})
    retriever_id = response["retrieverId"]

    return retriever_id


def delete_amazon_q_app(q_app_id):
    logger.info("Deleting Amazon Q App")
    response = amazon_q.delete_application(
        applicationId=q_app_id
    )
    logger.info("delete_application response", extra={"response": response})
    return response


def create_q_web_experience(amazon_q_app_id, q_app_name, q_web_exp_role_arn):
    response = amazon_q.create_web_experience(
        applicationId=amazon_q_app_id,
        title=q_app_name,
        roleArn=q_web_exp_role_arn,
        welcomeMessage=f"Welcome to Amazon Q {q_app_name}!",
    )
    logger.info("create_web_experience response", extra={"response": response})
    web_experience_id = response["webExperienceId"]

    return web_experience_id
