import os
import json
import datetime
import boto3
import time

def lambda_handler(event, context):
    # Check if the event is from API Gateway
    print(json.dumps(event))
    if 'httpMethod' in json.dumps(event):
        return handle_api_request(event, context)
    else:
        return on_event(event, context)

def handle_api_request(event, context):
    # Parse the goal from the request body
    try:
        body = json.loads(event['body'])
        goal = body['goal']
    except (KeyError, json.JSONDecodeError):
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid request body. Must include a "goal" field.'})
        }

    # Call the Batch job submission function with the new goal
    physical_id = "LangChainAgentBatchJob"
    result = submit_batch_job(goal, physical_id)

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Batch job submitted successfully', 'result': result})
    }

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
    initial_goal = os.environ['INITIAL_GOAL']
    return submit_batch_job(initial_goal, physical_id)

def submit_batch_job(goal, physical_id):
    aws_batch = boto3.client('batch')
    batch_job_queue = os.environ.get("BATCH_JOB_QUEUE")
    batch_job_definition = os.environ.get("BATCH_JOB_DEFINITION")
    repo_url = os.environ.get("REPO_URL")
    q_app_role_arn = os.environ.get("Q_APP_ROLE_ARN")
    s3_bucket = os.environ.get("S3_BUCKET")
    q_app_name = os.environ.get("Q_APP_NAME")
    ssh_url = os.environ.get("SSH_URL")
    ssh_key_name = os.environ.get("SSH_KEY_NAME")
    agent_knowledge_bucket = os.environ.get("AGENT_KNOWLEDGE_BUCKET")
    q_app_id = os.environ['AMAZON_Q_APP_ID']
    q_app_index = os.environ['Q_APP_INDEX']
    q_app_data_source_id = os.environ['Q_APP_DATA_SOURCE_ID']
    enable_graph = os.environ['ENABLE_GRAPH']
    neptune_graph_id = os.environ['NEPTUNE_GRAPH_ID']
    
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
            "name": "Q_APP_INDEX",
            "value": q_app_index
        },
        {
            "name": "Q_APP_ROLE_ARN",
            "value": q_app_role_arn
        },
        {
            "name": "NEPTUNE_GRAPH_ID",
            "value": neptune_graph_id
        },
        {
            "name": "Q_APP_DATA_SOURCE_ID",
            "value": q_app_data_source_id
        },
        {
            "name": "Q_APP_NAME",
            "value": q_app_name
        },
        {
            "name": "ENABLE_GRAPH",
            "value": enable_graph
        },
        {
            "name": "S3_BUCKET",
            "value": s3_bucket
        },
        {
            "name": "AGENT_KNOWLEDGE_BUCKET",
            "value": agent_knowledge_bucket
        }
        ],
        "command": [
            "sh","-c",f"apt-get update && apt -y install python3-venv git-all && python3  -m venv .venv && . .venv/bin/activate && pip install awscli boto3 pandas langchain langchain-community langchain-aws pexpect && aws s3 cp --recursive s3://{s3_bucket}/research-agent/ . && python3 main.py --goal '{goal}'"
        ]
    }

    if enable_graph == 'true':
        container_overrides["environment"].append({
            "name": "NEPTUNE_GRAPH_ID",
            "value": neptune_graph_id
        })

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
