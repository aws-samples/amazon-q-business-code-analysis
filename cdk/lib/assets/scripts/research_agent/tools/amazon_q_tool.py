from langchain_aws import ChatBedrock
from langchain_core.prompts import ChatPromptTemplate
import json
import boto3
import os
import uuid

MODEL_NAME = "claude-3-opus-20240229"
TEMPERATURE = 0
MAX_TOKENS = 4096
AMAZON_Q_APP_ID = os.environ["AMAZON_Q_APP_ID"]
INDEX_ID = os.environ["INDEX_ID"]
NEPTUNE_GRAPH_ID = os.environ["NEPTUNE_GRAPH_ID"]
ROLE_ARN = os.environ["ROLE_ARN"]

graph_llm = ChatBedrock(
    temperature=TEMPERATURE, 
    model_name=MODEL_NAME,
    max_tokens=MAX_TOKENS
)
amazon_q = boto3.client('qbusiness')
neptune_graph = boto3.client('neptune-graph')

class AmazonQTool:
    """A class to encapsulate the functionality of writing to files."""

    def __init__(self):
        """Initialize FileTool with the given directory.

        Args:
            directory (str): The directory to write files in.
        """
        self.amazon_q = boto3.client('qbusiness')

    def ask_question_about_repo(self,prompt):
        """Useful to ask a question about the repository.
        The input to this tool should be a prompt.
        For example, `What is the repository name?`."""
        amazon_q_user_id = 'random203409fasd@gmail.com'
        answer = amazon_q.chat_sync(
            applicationId=AMAZON_Q_APP_ID,
            userId=amazon_q_user_id,
            userMessage=prompt
        )
        return answer['systemMessage'], answer['sourceAttributions']
    
    def get_graph_context(self,prompt):
        """Useful to get the semantically similar nodes in the graph."""
        graph_context = []
        # Get top K by prompt
        embedding = self.generate_embeddings(prompt)
        get_semantically_similar_nodes = f"""CALL neptune.algo.vectors.topKByEmbedding( {embedding}, {{ topK: 5 }})
                    YIELD node, score
                    RETURN node, score"""
        r = neptune_graph.execute_query(
            graphIdentifier=NEPTUNE_GRAPH_ID,
            queryString=get_semantically_similar_nodes,
            language='opencypher'
        )
        response = r['payload'].read().decode('utf-8')
        graph_context.append(response)
        print(graph_context)
        return '\n'.join(graph_context)
    
    def reasoning_graph(self, input):
        """Useful to interact with the reasoning graph
        The input to this tool should be an OpenCypher query that will be executed and return a string of OpenCypher graph response."""
        commands = input.split(';')
        for command in commands:
            if (len(command) <= 1):
                continue
            try:
                r = neptune_graph.execute_query(
                    graphIdentifier=NEPTUNE_GRAPH_ID,
                    queryString=command,
                    language='opencypher'
                )
            except Exception as e:
                return "Executed OpenCypher queries until this one.: " + command + " with error: " + str(e) + "######\n\n There's no need to rerun the previous queries only the one that failed and the one's after it."
            response = r['payload'].read().decode('utf-8')
            if 'CREATE' in command:
                response = json.loads(response)
                # Check if id was returned
                if len(response['results']) == 0:
                    continue
                node_id = response['results'][0]['id']
                # Get Embedding
                # Upsert titan generated embedding for the node that was just created Expression: File {name: 'LexBedrockMessageProcessor.py', path: 'bedrock/knowledge-base-lex-langsmith/lambda/LexBedrockMessageProcessor.py'}
                embedding = self.generate_embeddings(command)
                query = f"""
                MATCH (n{{`~id`: "{node_id}"}})
                CALL neptune.algo.vectors.upsert(n, {str(embedding)})
                YIELD node, embedding, success
                RETURN node, embedding, success
                """
                try:
                    neptune_graph.execute_query(
                        graphIdentifier=NEPTUNE_GRAPH_ID,
                        queryString=query,
                        language='opencypher'
                    )
                except Exception as e:
                    print("Failed to upsert embeddings ", e)
        return "Successfully executed OpenCypher queries"

    
    def combine_q_answer_with_graph(self, prompt, q_answer, graph_context):
        """Useful to combine the answer and graph context.
        The input to this tool should be the answer and graph context.
        For example, `What is the repository name?`, `What is the repository name?`."""
        # New chain to answer original question combining q answer and graph response
        system = (
            """Combine the answer to the original question with the graph response to come up with a more complete answer. 
            Write the combined response between <response> and </response>.
            """
        )
        human = """Question: {question}
        Original Answer: {original_answer}
        Graph Response: {graph_response}"""

        prompt = ChatPromptTemplate.from_messages([("system", system), ("human", human)])

        chain = prompt | graph_llm

        final_answer = chain.invoke(
            {
                "question":prompt,
                "original_answer":q_answer,
                "graph_response":graph_context
            }
        )

        return final_answer.content
    
    def summarize_graph_response(self, prompt, graph_context):
        """Useful to combine the answer and graph context.
        The input to this tool should be the answer and graph context.
        For example, `What is the repository name?`, `What is the repository name?`."""
        # New chain to answer original question combining q answer and graph response
        system = (
            """Use the graph context to get an answer to the original question. 
            The context is not necessarily relevant to the question, we're just doing a semantic search.
            If you are unable to answer from from the context that is ok.
            Write your response between <response> and </response>.
            """
        )
        human = """Question: {question}
        Graph Response: {graph_response}"""

        prompt = ChatPromptTemplate.from_messages([("system", system), ("human", human)])

        chain = prompt | graph_llm

        final_answer = chain.invoke(
            {
                "question":prompt,
                "graph_response":graph_context
            }
        )

        return final_answer.content
    
    def generate_embeddings(self, body):
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
        model_id = "amazon.titan-embed-text-v2:0"

        response = bedrock.invoke_model(
            body=json.dumps({
                        "inputText": body
                    }), modelId=model_id, accept=accept, contentType=content_type
        )

        response_body = json.loads(response.get('body').read())

        return response_body['embedding']
        
    def get_complete_answer(self, prompt):
        """Useful to get a complete answer to a prompt.
        The input to this tool should be a prompt.
        For example, `What is the repository name?`."""
        # q_answer, sources = self.ask_question_about_repo(prompt)
        # print("Q Answer: ", q_answer)
        graph_context = self.get_graph_context(prompt)
        answer = self.summarize_graph_response(prompt, graph_context)
        # answer = self.combine_q_answer_with_graph(prompt, q_answer, graph_context)
        return answer

    def add_info_to_amazon_q(self, _input):
        """Useful to add knowledge to Amazon Q.
        The input to this tool should be a Q&A pair"""
        # Input is plain text
        _id = str(uuid.uuid4())
        amazon_q.batch_put_document(
            applicationId=AMAZON_Q_APP_ID,
            indexId=INDEX_ID,
            roleArn=ROLE_ARN,
            documents=[
                {
                    'id': _id,
                    'contentType': 'PLAIN_TEXT',
                    'title': _id,
                    'content':{
                        'blob': _input
                    },
                    'attributes': [
                        {
                            'name': 'url',
                            'value': {
                                'stringValue': 'AI Generated'+_id
                            }
                        }
                    ]
                },
            ]
        )