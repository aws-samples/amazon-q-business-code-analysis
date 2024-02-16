import boto3
import json
import datetime
import os 

amazon_q = boto3.client('qbusiness')
amazon_q_app_id = os.environ['AMAZON_Q_APP_ID']
amazon_q_user_id = os.environ['AMAZON_Q_USER_ID']
index_id = os.environ['Q_APP_INDEX']
role_arn = os.environ['Q_APP_ROLE_ARN']
repo_url = os.environ['REPO_URL']

def main():
    print(f"Processing repository... {repo_url}")
    process_repository(repo_url)
    print(f"Finished processing repository {repo_url}")

def ask_question_with_attachment(prompt, filename):
    data=open(filename, 'rb')
    answer = amazon_q.chat_sync(
        applicationId=amazon_q_app_id,
        userId=amazon_q_user_id,
        userMessage=prompt,
        attachments=[
            {
                'data': data.read(),
                'name': filename
            },
        ],
    )
    return answer['systemMessage']

import uuid

def upload_prompt_answer_and_file_name(filename, prompt, answer):
    amazon_q.batch_put_document(
        applicationId=amazon_q_app_id,
        indexId=index_id,
        roleArn=role_arn,
        documents=[
            {
                'id': str(uuid.uuid4()),
                'contentType': 'PLAIN_TEXT',
                'title': filename,
                'content':{
                    'blob': f"{filename} | {prompt} | {answer}".encode('utf-8')
                },
                'attributes': [
                    {
                        'name': 'url',
                        'value': {
                            'stringValue': f"{repo_url[:-4]}/{filename}"
                        }
                    }
                ]
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
        f.write(answer)

def should_ignore_path(path):
    path_components = path.split(os.sep)
    for component in path_components:
        if component.startswith('.'):
            return True
    return False

import git
import shutil

def process_repository(repo_url, ssh_url=None):

    # Temporary clone location
    tmp_dir = f"/tmp/{datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}" 

    destination_folder = 'repositories/'

    # Clone the repository
    # If you authenticate with some other repo provider just change the line below
    print(f"Cloning repository... {repo_url}")
    if ssh_url:
        repo = git.Repo.clone_from(ssh_url, tmp_dir)
    else:
        repo = git.Repo.clone_from(repo_url, tmp_dir)
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
            if file.endswith(('.png', '.jpg', '.jpeg', '.gif', '.zip')):
                continue
            # Ignore files that start with a dot (.)
            if file.startswith('.'):
                continue
                
            file_path = os.path.join(root, file)
            
            for attempt in range(3):
                try:
                    print(f"\033[92mProcessing file: {file_path}\033[0m")
                    # prompt = "Generate comprehensive documentation about the attached file. Make sure you include what dependencies and other files are being referenced as well as function names, class names, and what they do."
                    prompt = "Come up with a list of questions and answers about the attached file. Keep answers dense with information. A good question for a database related file would be 'What is the database technology and architecture?' or for a file that executes SQL commands 'What are the SQL commands and what do they do?' or for a file that contains a list of API endpoints 'What are the API endpoints and what do they do?'"
                    answer = ask_question_with_attachment(prompt, file_path)
                    upload_prompt_answer_and_file_name(file_path, prompt, answer)
                    save_answers(answer, file_path, "documentation/")
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

if __name__ == "__main__":
    main()