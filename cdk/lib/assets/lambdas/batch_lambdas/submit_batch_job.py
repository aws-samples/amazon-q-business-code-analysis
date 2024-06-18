import os
import json
import datetime
import boto3
import time

def on_event(event, context):
    physical_id = "PhysicalIdAmazonQCodeAnalysisApp"
    request_type = event['RequestType']
    if request_type == 'Create': return on_create(event, physical_id=physical_id)
    physical_id = event['PhysicalResourceId']
    if request_type == 'Update': return on_update(event, physical_id=physical_id)
    if request_type == 'Delete': return on_delete(event, physical_id=physical_id)
    raise Exception("Invalid request type: %s" % request_type)

def on_update(event, physical_id):
    props = event["ResourceProperties"]
    print("update resource %s with props %s" % (physical_id, props))

    return { 'PhysicalResourceId': physical_id }

def on_delete(event, physical_id):
    print("delete resource %s" % physical_id)
    return { 'PhysicalResourceId': physical_id }

def on_create(event, physical_id):
    aws_batch = boto3.client('batch')
    batch_job_queue = os.environ.get("BATCH_JOB_QUEUE")
    batch_job_definition = os.environ.get("BATCH_JOB_DEFINITION")
    repo_url = os.environ.get("REPO_URL")
    q_app_role_arn = os.environ.get("Q_APP_ROLE_ARN")
    s3_bucket = os.environ.get("S3_BUCKET")
    q_app_name = os.environ.get("Q_APP_NAME")
    ssh_url = os.environ.get("SSH_URL")
    ssh_key_name = os.environ.get("SSH_KEY_NAME")
    q_app_id = os.environ['AMAZON_Q_APP_ID']
    q_app_index = os.environ['Q_APP_INDEX']
    q_app_data_source_id = os.environ['Q_APP_DATA_SOURCE_ID']

    container_overrides = {
        "environment": [{
            "name": "REPO_URL",
            "value": repo_url
        },
        {
            "name": "SSH_URL",
            "value": ssh_url
        },
        {
            "name": "SSH_KEY_NAME",
            "value": ssh_key_name
        },
        {
            "name": "AMAZON_Q_APP_ID",
            "value": q_app_id
        },
        {
            "name": "Q_APP_INDEX",
            "value": q_app_index
        },
        {
            "name": "Q_APP_ROLE_ARN",
            "value": q_app_role_arn
        },
        {
            "name": "Q_APP_DATA_SOURCE_ID",
            "value": q_app_data_source_id
        },
        {
            "name": "Q_APP_NAME",
            "value": q_app_name
        }
        ],
        "command": [
            "sh","-c",f"yum -y install python-pip git && pip install boto3 awscli GitPython && aws s3 cp s3://{s3_bucket}/code-processing/generate_documentation_and_ingest_code.py . && python3 generate_documentation_and_ingest_code.py"
        ]
    }

    batch_job_name = f"aws-batch-job-code-analysis{datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}"
    print(f"Submitting job {batch_job_name} to queue {batch_job_queue} with definition {batch_job_definition} and container overrides {container_overrides}")
    response = aws_batch.submit_job(jobName=batch_job_name,
                                jobQueue=batch_job_queue,
                                jobDefinition=batch_job_definition,
                                containerOverrides=container_overrides)
    print(json.dumps(response))
    return { 'PhysicalResourceId': physical_id}
