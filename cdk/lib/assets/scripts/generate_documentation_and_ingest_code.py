import boto3
import json
import datetime
import os 
import git
import shutil
import tempfile
import uuid
import re
import random

bedrock = boto3.client('bedrock-runtime')
amazon_q = boto3.client('qbusiness')
neptune_graph = boto3.client('neptune-graph')
bedrock = boto3.client('bedrock-runtime')
amazon_q_app_id = os.environ['AMAZON_Q_APP_ID']
index_id = os.environ['Q_APP_INDEX']
role_arn = os.environ['Q_APP_ROLE_ARN']
q_app_data_source_id = os.environ['Q_APP_DATA_SOURCE_ID']
repo_url = os.environ['REPO_URL']
# Optional retrieve the SSH URL and SSH_KEY_NAME for the repository
ssh_url = os.environ.get('SSH_URL')
ssh_key_name = os.environ.get('SSH_KEY_NAME')
neptune_graph_id = os.environ.get('NEPTUNE_GRAPH_ID')

def main():
    print(f"Processing repository... {repo_url}")
    # If ssh_url ends with .git then process it
    if ssh_url and ssh_url.endswith('.git'):
        process_repository(repo_url, ssh_url)
    else:
        process_repository(repo_url)
    print(f"Finished processing repository {repo_url}")

def format_prompt(prompt, code_text):
     formatted_prompt = f"""
     {prompt}
     File content: {code_text}
     """
     
     return formatted_prompt    

def ask_question_with_attachment(prompt, file_path):
     model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
     response = bedrock.invoke_model(
         modelId=model_id,
         body=json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                 "max_tokens": 1024,
                 "messages": [
                     {
                         "role": "user",
                         "content": [{"type": "text", "text": f"File path: {file_path}\n" + prompt}],
                  }
               ],
             }
        ),
     )
     result = json.loads(response.get("body").read())

     return result.get("content", [])


def upload_prompt_answer_and_file_name(filename, prompt, answer, repo_url, branch, sync_job_id):
    base_url = repo_url[:-4]
    cleaned_file_name = f"{base_url}/blob/{branch}/{'/'.join(filename.split('/')[1:])}"
    print(f"Cleaned File Name: {cleaned_file_name}")
    amazon_q.batch_put_document(
        applicationId=amazon_q_app_id,
        indexId=index_id,
        roleArn=role_arn,
        documents=[
            {
                'id': str(uuid.uuid4()),
                'contentType': 'PLAIN_TEXT',
                'title': cleaned_file_name,
                'content':{
                    'blob': f"{cleaned_file_name} | {prompt} | {answer}".encode('utf-8')
                },
                'attributes': [
                    {
                        'name': '_source_uri',
                        'value': {
                            'stringValue': cleaned_file_name
                        }
                    },
                    {
                        'name': '_data_source_id',
                        'value': {
                            'stringValue': q_app_data_source_id
                        }
                    },
                    {
                        'name': '_data_source_sync_job_execution_id',
                        'value': {
                            'stringValue': sync_job_id
                        }
                    }
                ],
            },
        ]
    )

# Function to save generated answers to folder documentation/
def save_answers(answer, filepath, folder):
    import os
    # Only create directory until the last / of filepath
    sub_directory = f"{folder}{filepath[:filepath.rfind('/')+1]}"
    if not os.path.exists(sub_directory):
        # Only create directory until the last /
        os.makedirs(sub_directory)
    # Replace all file endings with .txt
    filepath = filepath[:filepath.rfind('.')] + ".txt"
    with open(f"{folder}{filepath}", "w") as f:
        f.write(str(answer))

def should_ignore_path(path):
    path_components = path.split(os.sep)
    for component in path_components:
        if component.startswith('.'):
            return True
        elif component == 'node_modules':
            return True
        elif component == '__pycache__':
            return True
    return False

def get_ssh_key(secret_name):
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=secret_name)
    return response['SecretString']

def write_ssh_key_to_tempfile(ssh_key):
    with tempfile.NamedTemporaryFile(delete=False) as f:
        os.chmod(f.name, 0o600)
        f.write(ssh_key.strip().encode() + b'\n')  # Add a newline character at the end
        return f.name

def generate_embeddings(body):
    """
    Generate a vector of embeddings for a text input using Amazon Titan Embeddings G1 - Text on demand.
    Args:
        model_id (str): The model ID to use.
        body (str) : The request body to use.
    Returns:
        response (JSON): The text that the model generated, token information, and the
        reason the model stopped generating text.
    """

    bedrock = boto3.client(service_name='bedrock-runtime')

    accept = "application/json"
    content_type = "application/json"
    model_id = "amazon.titan-embed-text-v1"

    response = bedrock.invoke_model(
        body=json.dumps({
                    "inputText": body
                }), modelId=model_id, accept=accept, contentType=content_type
    )

    response_body = json.loads(response.get('body').read())

    return response_body['embedding']

def add_graph_nodes_and_edges(code_file):
    # Turn code file into text
    code = open(code_file, 'r')
    code_text = code.read()
    code.close()
    # Process code with prompt
    prompt = f"""
    You are a Neptune Graph Applied Scientist familiar with Generative AI.
    You will be creating commands to generate and populate a knowledge graph from code.
    Every code file in one, or more, repositories is passed to you separately.
    Each code file should have a respective node in the graph.
    You must generate opencypher commands we can execute to populate the graph.
    Write the OpenCypher commands between <commands> and </commands>.
    Write relevant file paths to explore between <file_paths> and </file_paths>.
    When you create nodes YOU MUST make the node names as detailed as possible to keep them unique ALSO MAKE SURE TO RETURN THE ID OF THE NODE YOU CREATE., i.e. CREATE (LexBedrockMessageProcessor:File {{name: 'KnowledgeBaseLexLangSmithLexBedrockMessageProcessor', path: 'bedrock/knowledge-base-lex-langsmith/lambda/LexBedrockMessageProcessor.py'}} RETURN id(LexBedrockMessageProcessor) as id
    Seperate queries with ;
    Capture information and relationships on functions, classes, and other relevant information.
    Repository: {repo_url}
    Filename: {code_file}
    File content: {code_text}
    """
    model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1024,
                "messages": [
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": prompt}],
                    }
                ],
            }
        ),
    )
    result = json.loads(response.get("body").read())
    output_list = result.get("content", [])
    for output in output_list:
        code_text += output["text"]
    # Parse commands out of code_text
    commands = re.findall(r'<commands>(.*?)</commands>', code_text, re.DOTALL)
    # Print commands
    print(commands[0])
    # Split by ; and execute each command
    commands = commands[0].split(';')
    for command in commands:
        # Check if create command
        if 'CREATE' in command:
            r = neptune_graph.execute_query(
                graphIdentifier=neptune_graph_id,
                queryString=command,
                language='opencypher'
            )
            response = r['payload'].read().decode('utf-8')
            response = json.loads(response)
            # Check if id was returned
            if len(response['results']) == 0:
                continue
            node_id = response['results'][0]['id']
            # Get Embedding
            # Upsert titan generated embedding for the node that was just created Expression: File {name: 'LexBedrockMessageProcessor.py', path: 'bedrock/knowledge-base-lex-langsmith/lambda/LexBedrockMessageProcessor.py'}
            # Generate embedding
            embedding = generate_embeddings(command)
            query = f"""
            MATCH (n{{`~id`: "{node_id}"}})
            CALL neptune.algo.vectors.upsert(n, {str(embedding)})
            YIELD node, embedding, success
            RETURN node, embedding, success
            """
            neptune_graph.execute_query(
                graphIdentifier=neptune_graph_id,
                queryString=query,
                language='opencypher'
            )
    # Create OpenCypher command to link related files to the uploaded file
    file_paths = re.search(r'<file_paths>(.*?)</file_paths>', code_text, re.DOTALL)
    file_paths = file_paths[0].split('\n')
    for file_path in file_paths:
        if file_path:
            neptune_graph.execute_query(
                graphIdentifier=neptune_graph_id,
                queryString=f"""
                MATCH (a:File {{name: "{code_file}"}})
                MATCH (b:File {{name: "{file_path}"}})
                MERGE (a)-[:RELATED_TO]->(b)
                """,
                language='opencypher'
            )

def process_repository(repo_url, ssh_url=None):

    sync_job_id = amazon_q.start_data_source_sync_job(
        applicationId=amazon_q_app_id,
        dataSourceId=q_app_data_source_id,
        indexId=index_id
    )['executionId']

    # Temporary clone location
    tmp_dir = f"/tmp/{datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}" 

    destination_folder = 'repositories/'

    if not os.path.exists(destination_folder):
        os.makedirs(destination_folder)

    # Clone the repository
    print(f"Cloning repository... {repo_url}")
    if ssh_url:
        ssh_key = get_ssh_key(ssh_key_name)
        ssh_key_file = write_ssh_key_to_tempfile(ssh_key)
        ssh_command = f"ssh -i {ssh_key_file} -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"
        repo = git.Repo.clone_from(ssh_url, tmp_dir, env={"GIT_SSH_COMMAND": ssh_command})
        branch = repo.active_branch
        print(f"Active Branch Name: {branch}")
    else:
        repo = git.Repo.clone_from(repo_url, tmp_dir)
        branch = repo.active_branch
        print(f"Active Branch Name: {branch}")
    print(f"Finished cloning repository {repo_url}")
    # Copy all files to destination folder
    for src_dir, dirs, files in os.walk(tmp_dir):
        dst_dir = src_dir.replace(tmp_dir, destination_folder)
        if not os.path.exists(dst_dir):
            os.mkdir(dst_dir)
        for file_ in files:
            src_file = os.path.join(src_dir, file_)
            dst_file = os.path.join(dst_dir, file_)
            if os.path.exists(dst_file):
                os.remove(dst_file)
            shutil.copy(src_file, dst_dir)
    
    # Delete temp clone       
    shutil.rmtree(tmp_dir)

    import time

    processed_files = []
    failed_files = []
    print(f"Processing files in {destination_folder}")
    for root, dirs, files in os.walk(destination_folder):
        if should_ignore_path(root):
            continue
        for file in files:
            if file.endswith(('.png', '.jpg', '.jpeg', '.gif', '.zip', '.pyc')):
                continue
            # Ignore files that start with a dot (.)
            if file.startswith('.'):
                continue
                
            file_path = os.path.join(root, file)
            
            for attempt in range(3):
                try:
                    prompts = [
                        "Come up with a list of questions and answers about the attached file. Keep answers dense with information. A good question for a database related file would be 'What is the database technology and architecture?' or for a file that executes SQL commands 'What are the SQL commands and what do they do?' or for a file that contains a list of API endpoints 'What are the API endpoints and what do they do?'",
                        "Generate comprehensive documentation about the attached file. Make sure you include what dependencies and other files are being referenced as well as function names, class names, and what they do.",
                        "Identify anti-patterns in the attached file. Make sure to include examples of how to fix them. Try Q&A like 'What are some anti-patterns in the file?' or 'What could be causing high latency?'",
                        "Suggest improvements to the attached file. Try Q&A like 'What are some ways to improve the file?' or 'Where can the file be optimized?'"
                    ]
                    answers = []
                    print(f"\033[92mProcessing file: {file_path}\033[0m")
                    code_text = code.read()
                    code.close()
                    for prompt in prompts:
                        formatted_prompt = format_prompt(prompt, code_text)
                        answer = ask_question_with_attachment(prompt, file_path)
                        upload_prompt_answer_and_file_name(file_path, prompt, answer, repo_url, branch, sync_job_id)
                        answers.append(answer)
                    # Upload the file itself to the index
                    code = open(file_path, 'r')
                    upload_prompt_answer_and_file_name(file_path, "", code.read(), repo_url)
                    code.close()
                    # Save the answers to a file
                    save_answers('\n'.join(answers), file_path, "documentation/")
                    # Add nodes and edges to the graph
                    #add_graph_nodes_and_edges(file_path)
                    processed_files.append(file)
                    break
                except Exception as e:
                    print(f"Error: {e}")
                    time.sleep(15)
            else:
                print(f"\033[93mSkipping file: {file_path}\033[0m")
                failed_files.append(file_path)
                
    print(f"Processed files: {processed_files}")
    print(f"Failed files: {failed_files}")
    # Stop data source sync
    amazon_q.stop_data_source_sync_job(
        applicationId=amazon_q_app_id,
        dataSourceId=q_app_data_source_id,
        indexId=index_id,
    )

if __name__ == "__main__":
    main()