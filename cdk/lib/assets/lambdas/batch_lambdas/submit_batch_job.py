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
    q_app_user_id = os.environ.get("Q_APP_USER_ID")
    ssh_url = os.environ.get("SSH_URL")
    ssh_key_name = os.environ.get("SSH_KEY_NAME")
    print("Getting AP id and index...")
    q_app_id = get_q_app_id(q_app_name)
    q_app_index = get_q_app_index(q_app_name, q_app_id)

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
            "name": "AMAZON_Q_USER_ID",
            "value": q_app_user_id
        },
        {
            "name": "Q_APP_INDEX",
            "value": q_app_index
        },
        {
            "name": "Q_APP_ROLE_ARN",
            "value": q_app_role_arn
        }],
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

def get_q_app_id(q_app_name):
    """
    Retrieves the Q-App ID from the Q-Business API.

    Args:
        q_app_name (str): Name of the Q-App.

    Returns:
        str: Q-App ID.
    """
    amazon_q = boto3.client('qbusiness')
    amazon_q_app_id = None
    q_applications = amazon_q.list_applications(maxResults=100)
    for attempt in range(0, 15):
        for application in q_applications['applications']:
            application_name = application['displayName']
            names_match = str(application_name) == str(q_app_name)
            print(f"Checking application {application_name} against {q_app_name}. Evaluated to f{names_match}")
            if names_match:
                amazon_q_app_id = application['applicationId']
                break
        if names_match:
            break
        else:
            print(f"Q-App {q_app_name} not found. Retrying...")
            time.sleep(10)
    if amazon_q_app_id is None:
        raise Exception(f"Q-App {q_app_name} not found.")
    return amazon_q_app_id

def get_q_app_index(q_app_name, q_app_id):
    """
    Retrieves the Q-App Index from the Q-Business API.

    Args:
        q_app_id (str): Q-App ID.

    Returns:
        str: Q-App Index.
    """
    amazon_q = boto3.client('qbusiness')
    amazon_q_indices = amazon_q.list_indices(applicationId=q_app_id)['indices']
    return amazon_q_indices[0]['indexId']
