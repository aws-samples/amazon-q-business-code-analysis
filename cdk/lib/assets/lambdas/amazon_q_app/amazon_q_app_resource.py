import boto3
import os
import time
import json
import datetime
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
import botocore.session

amazon_q = boto3.client('qbusiness')

def on_event(event, context):
  q_app_name = os.environ['Q_APP_NAME']
  q_app_role_arn = os.environ['Q_APP_ROLE_ARN']
  # physical_id = "PhysicalIdAmazonQCodeAnalysisApp"

  print(json.dumps(event))
  request_type = event['RequestType']
  if request_type == 'Create': return on_create(event,  
                                                q_app_name=q_app_name,
                                                q_app_role_arn=q_app_role_arn,
                                                )
  physical_id = event['PhysicalResourceId']
  if request_type == 'Update': return on_update(event, physical_id=physical_id)
  if request_type == 'Delete': return on_delete(event, physical_id=physical_id)
  raise Exception("Invalid request type: %s" % request_type)


def on_create(event, q_app_name, q_app_role_arn):
  props = event["ResourceProperties"]
  print("create new resource with props %s" % props)

  # Create Amazon Q App
  amazon_q_app_id = create_q_app(q_app_name=q_app_name,
                                 role_arn=q_app_role_arn)
  
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
  
  return { 
    'PhysicalResourceId': amazon_q_app_id, 
    'Data': { 
        'AmazonQAppId': amazon_q_app_id, 
        'AmazonQIndexId': amazon_q_index_id, 
        'AmazonQRetrieverId': amazon_q_retriever_id 
      }
  }


def on_update(event, physical_id):
  # physical_id = event["PhysicalResourceId"]
  props = event["ResourceProperties"]
  print("update resource %s with props %s" % (physical_id, props))

  return { 'PhysicalResourceId': physical_id } 


def on_delete(event, physical_id):
  # physical_id = event["PhysicalResourceId"]
  print("delete resource %s" % physical_id)
  delete_amazon_q_app(q_app_id=physical_id)

  return { 'PhysicalResourceId': physical_id } 


def create_q_app(q_app_name, role_arn):
  import datetime
  response = amazon_q.create_application(
        attachmentsConfiguration={
            'attachmentsControlMode': 'ENABLED'
        },
        displayName=q_app_name,
        description=f"{q_app_name} created with Cloudformation on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        roleArn=role_arn,
    )
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
    )
    index_id = response["indexId"]

    while True:
      response = amazon_q.get_index(
      applicationId=amazon_q_app_id,
      indexId=index_id,
      )
      status = response.get('status')
      print(f"Creat index status {status}")
      if status == 'ACTIVE':
          break
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
    retriever_id = response["retrieverId"]

    return retriever_id

def delete_amazon_q_app(q_app_id):
  response = amazon_q.delete_application(
        applicationId=q_app_id
    )

  return response