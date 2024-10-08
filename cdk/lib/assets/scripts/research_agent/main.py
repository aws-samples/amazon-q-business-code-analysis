import re
import os
import pandas as pd
from langchain import LLMChain, PromptTemplate
from langchain.agents import Tool, AgentExecutor, LLMSingleActionAgent
from langchain_aws import ChatBedrock
from tools.bash_tool import BashTool
from tools.file_tool import FileTool
from tools.amazon_q_tool import AmazonQTool
from langchain_customization.callback_manager import CallbackManager
from langchain_customization.custom_classes import CustomPromptTemplate, CustomOutputParser
import argparse

# Constants
MAX_META_ITERS = 5
TEMPERATURE = 0.7
MODEL_ID = "anthropic.claude-3-5-sonnet-20240620-v1:0"
TIMEOUT = 9999
STREAMING = True

# Initialize tools
bash_tool = BashTool()
file_tool = FileTool()
amazon_q_tool = AmazonQTool()

enable_graph = os.environ.get("ENABLE_GRAPH", "false")
s3_bucket = os.environ.get("S3_BUCKET", None)

tools = [
    Tool(
        name="Bash",
        func=bash_tool.run_command,
        description="Execute bash commands"
    ),
    Tool(
        name="File Writer",
        func=file_tool.write_file,
        description="""Useful to write a file to a given path with a given content. 
        The input to this tool should be a pipe (|) separated text 
        of length two, representing the path of the file."""
    ),
    Tool(
        name="Add knowledge to Amazon Q Data Lake",
        func=amazon_q_tool.add_info_to_amazon_q,
        description="Add detailed information about code and data flow to the Amazon Q data lake. Use this XML format:<entry><file_name>application/component/data-flow.txt</file_name><content>Answer to 'How does data flow through X application?' Include key components, data transformations, and relevant code snippets or architecture diagrams.</content></entry>Example: <entry><file_name>e-commerce/order-processing/data-flow.txt</file_name><content>Data flow in the order processing system: 1) User submits order via REST API. 2) OrderService validates and persists order in database. 3) KafkaProducer sends order to 'new-orders' topic. 4) InventoryService consumes message, updates stock. 5) ShippingService prepares shipment. Key components: API Gateway, OrderService, KafkaProducer, InventoryService, ShippingService. Source: https://github.com/example/e-commerce-app</content></entry>"
    )
]

if enable_graph == "true":
    tools.append(
        Tool(
            name="Chat with Reasoning Graph",
            func=amazon_q_tool.get_complete_answer,
            description="Chat with the information currently in the reasoning graph to get an answer. Input should be a question."
        )
    )
    tools.append(
        Tool(
            name="Reasoning Graph",
            func=amazon_q_tool.reasoning_graph,
            description="""Input should be a OpenCypher commands/queries divided by ;. You can query, update, or add data to this Neptune Graph. For example you can add a new node, get a node's neighbors, or link nodes together.
            Note, whenever you create a new node or nodes, make sure to also return their ids in the same command, i.e.
            <example>
            CREATE (LexBedrockMessageProcessor:File {name: 'KnowledgeBaseLexLangSmithLexBedrockMessageProcessor', path: 'bedrock/knowledge-base-lex-langsmith/lambda/LexBedrockMessageProcessor.py'} RETURN id(LexBedrockMessageProcessor) as id;
            CREATE (TSConfig:File {name: 'tsconfig.json', path: 'tsconfig.json'}) RETURN id(TSConfig) as id;
            </example>
            You must write ONE COMMAND per CREATE.
            Note this is running Amazon Neptune. When using this tool assume you are a Neptune Applied Scientist with vast knowledge of Generative AI.
            """
        )
    )

# Initialize parser and callback manager
output_parser = CustomOutputParser()
cb = CallbackManager()

agent_llm = ChatBedrock(
    model_kwargs={"temperature":TEMPERATURE}, 
    model_id=MODEL_ID,
    callbacks=[cb],
)

def get_init_prompt():
    """Returns initial prompt for the Agent."""
    return """Your name is David.

    If something doesn't work twice in a row try something new.

    Never give up until you accomplish your goal.

    You have access to the following tools:

    {tools}

    Use the following format:

    Goal: the goal you are built to accomplish
    Thought: you should always think about what to do
    Action: the action to take, must be one of [{tool_names}]
    Action Input: the input to the action
    Observation: the result of the action
    ... (this Thought/Action/Action Input/Observation can repeat N times)
    Thought: I have now completed my goal
    Final Summary: a final memo summarizing what was accomplished
    Constraints: {constraints}
    Tips: {tips}
    Current state of the world: {current_world_state}

    Note: You will continue operating in the current world, try to continue from where the last agent left off.
    Here are some recent commands and observations that may be useful to orient yourself as you begin:
    pwd
    {pwd_output}
    ls
    {ls_output}
    Begin!
    Goal: {input}
    {agent_scratchpad}"""

def initialize_agent(david_instantiation_prompt: str):
    """Initializes agent with provided prompt.

    Args:
        david_instantiation_prompt: The prompt for initializing the agent.

    Returns:
        Agent executor object.
    """
    prompt = CustomPromptTemplate(
        template=david_instantiation_prompt,
        tools=tools,
        input_variables=["input", "constraints", "tips", "intermediate_steps", "current_world_state", "ls_output", "pwd_output"]
    )
    # LLM chain consisting of the LLM and a prompt
    llm_chain = LLMChain(llm=agent_llm, prompt=prompt)
    tool_names = [tool.name for tool in tools]
    agent = LLMSingleActionAgent(
        llm_chain=llm_chain, 
        output_parser=output_parser,
        stop=["\nObservation:"], 
        allowed_tools=tool_names
    )
    agent_executor = AgentExecutor.from_agent_and_tools(agent=agent, tools=tools, verbose=True)
    return agent_executor

def initialize_world_state_chain():
    """Initializes and returns a world state chain."""
    world_state_template="""
    Given the current state of the world:

    {current_world_state}

    And Given the following series of actions and observations:

    ###Actions and Observations###
    {david_execution}
    ###End of Actions and Observations###

Generate a comprehensive model of the world that includes:

1. A description of the current state of the environment.
2. A summary of the actions taken and their results.
3. Any constraints, limitations, or rules that apply to the environment.
4. Relevant information or context that is necessary to understand the current state of the world. For instance the arn, or at least bucket name, of a bucket that is being used to reach the goal should be recorded.
5. Next steps a new agent should take to continue working towards the goal.

In other words, synthesize the information provided to build a model of the world in which the AI is operating.
The goal we are trying to accomplish is the following: {goal}.
    """

    world_state_prompt = PromptTemplate(
        input_variables=["goal", "david_execution", "current_world_state"], 
        template=world_state_template
    )
    # Using Anthropic
    world_state_chain = LLMChain(
        prompt=world_state_prompt, 
        llm=ChatBedrock(
            model_kwargs={"temperature":TEMPERATURE}, 
            model_id=MODEL_ID,
        ),
        verbose=True, 
    )
    return world_state_chain

def initialize_meta_chain():
    """Initializes and returns a language learning model chain."""
    meta_template="""{{I want to instantiate an AI I'm calling David who successfully accomplishes my GOAL.}}

    #######
    MY GOAL
    #######

    {goal}

    ##############
    END OF MY GOAL
    ##############

    ##########################
    Current state of the world
    ##########################

    {current_world_state}

    #################################
    End of current state of the world
    #################################

    ##############
    END OF MY GOAL
    ##############

    ############################
    DAVID'S INSTANTIATION PROMPT
    ############################

    {david_instantiation_prompt}

    ###################################
    END OF DAVID'S INSTANTIATION PROMPT
    ###################################

    #################
    DAVID'S EXECUTION
    #################

    {david_execution}

    ########################
    END OF DAVID'S EXECUTION
    ########################

    {{I do not count delegation back to myself as success.}}
    {{I will write an improved prompt specifying a new constraint and a new tip to instantiate a new David who hopefully gets closer to accomplishing my goal.}}
    {{Too bad I cannot add new tools, good thing bash is enough for someone to do anything.}}
    {{Even though David may think he did enough to complete goal I do not count it as success, lest I would not need to write a new prompt.}}

    ###############
    IMPROVED PROMPT
    ###############

    """

    meta_prompt = PromptTemplate(
        input_variables=["goal", "david_instantiation_prompt", "david_execution", "current_world_state"], 
        template=meta_template
    )

    meta_chain = LLMChain(
        llm=ChatBedrock(
            model_kwargs={"temperature":TEMPERATURE}, 
            model_id=MODEL_ID,
        ),
        prompt=meta_prompt, 
        verbose=True, 
    )
    return meta_chain

evaluation_prompt_template = """
{execution_output}

Note that delegation does not count as success. Based on the above execution output, was the goal of "{goal}" accomplished? (Yes/No)
"""

def initialize_evaluation_chain():
    """Initializes and returns a goal evaluation chain."""
    evaluation_prompt = PromptTemplate(
        input_variables=["execution_output", "goal"], 
        template=evaluation_prompt_template
    )
    evaluation_chain = LLMChain(
        llm=ChatBedrock(
            model_kwargs={"temperature":TEMPERATURE}, 
            model_id=MODEL_ID,
        ),
        prompt=evaluation_prompt, 
        verbose=True,
    )
    return evaluation_chain

def get_new_instructions(meta_output):
    """Extracts and returns new constraints and tips from meta output.

    Args:
        meta_output: Output from the meta-chain.

    Returns:
        Tuple containing new constraints and tips.
    """
    constraints_pattern = r"Constraints: ([^\n]*)(?=Tips:|\n|$)"
    tips_pattern = r"Tips: ([^\n]*)(?=Constraints:|\n|$)"
    
    constraints_match = re.search(constraints_pattern, meta_output)
    tips_match = re.search(tips_pattern, meta_output)
    
    constraints = constraints_match.group(1).strip() if constraints_match else None
    tips = tips_match.group(1).strip() if tips_match else None
    
    return constraints, tips

def parse_arguments():
    """
    Parses command-line arguments.
    
    Returns:
        goal (str): The parsed goal from the command-line arguments or from a text file.
    """
    parser = argparse.ArgumentParser(description="AI Meta Iteration Script")
    parser.add_argument("--goal", help="Specify the goal", required=True)
    args = parser.parse_args()

    if args.goal.endswith('.txt'):
        with open(args.goal, 'r') as file:
            return file.read().strip()

    return args.goal

def main(goal, max_meta_iters=2):
    """Main execution function.

    Args:
        goal: The goal for the AI.
        max_meta_iters: Maximum iterations for the meta AI.

    Returns:
        None.
    """
    david_instantiation_prompt = get_init_prompt()
    constraints = "You cannot use the open command. Everything must be done in the terminal. You cannot use nano or vim."
    tips = f"""You are in an Ubuntu runtime. You are already authenticated with AWS. To write to a file use the File Writer tool. Use non-blocking commands like cdk deploy --require-approval never. To write multiple commands use &&. You are already a sudo user."""
    world_state_chain = initialize_world_state_chain()
    current_world_state = "The world is empty and has just been initialized."
    evaluation_chain = initialize_evaluation_chain()
    # Check if the CSV file exists
    if os.path.isfile('successful_invocations.csv'):
        # Load the dataframe from the CSV file
        df = pd.read_csv('successful_invocations.csv')
    else:
        # Create a new DataFrame if the CSV file doesn't exist
        df = pd.DataFrame(columns=['Goal', 'InstantiationPrompt', 'Constraints', 'Tips'])
    for i in range(max_meta_iters):
        print(f'[Episode {i+1}/{max_meta_iters}]')
        agent = initialize_agent(david_instantiation_prompt)
        try:
            # ls_output and pwd_output from bash tool
            ls_output = bash_tool.run_command("ls")
            pwd_output_ = bash_tool.run_command("pwd")
            agent.run(input=goal, constraints=constraints, tips=tips, current_world_state=current_world_state, ls_output=ls_output, pwd_output=pwd_output_)
        except Exception as e:
            print(f'Exception: {e}')
            print('Continuing...')
        execution_output = ''.join(cb.last_execution)
        evaluation_output = evaluation_chain.predict(execution_output=execution_output, goal=goal)
        current_world_state = world_state_chain.predict(
            current_world_state=current_world_state,
            goal=goal, 
            david_execution=''.join(cb.last_execution)
        )
        if 'yes' in evaluation_output.strip().lower():
            print("Goal has been accomplished!")
            df = pd.concat([df, pd.DataFrame([{'Goal': goal, 'InstantiationPrompt': david_instantiation_prompt, 'Constraints': constraints, 'Tips': tips}])], ignore_index=True)
            # Save the DataFrame back to the CSV file
            df.to_csv('successful_invocations.csv', index=False)
            break
        meta_chain = initialize_meta_chain()
        temp_prompt = PromptTemplate(
            input_variables=["tool_names","tools","input","constraints","tips","agent_scratchpad", "current_world_state", "ls_output", "pwd_output"],
            template=david_instantiation_prompt
        )
        # Get latest ls and pwd output
        ls_output = bash_tool.run_command("ls")
        pwd_output = bash_tool.run_command("pwd")
        temp_prompt = temp_prompt.format(
            tools="Bash", 
            tool_names="Bash Tool", 
            input=goal, 
            constraints=constraints, 
            tips=tips, 
            current_world_state=current_world_state,
            agent_scratchpad="",
            ls_output=ls_output,
            pwd_output=pwd_output
        )
        meta_output = meta_chain.predict(
            goal=goal, 
            david_instantiation_prompt=temp_prompt,
            david_execution=execution_output,
            current_world_state=current_world_state
        )
        print(f'New Prompt: {meta_output}')
        constraints, tips = get_new_instructions(meta_output)
        cb.last_execution = []
        print(f'New Constraints: {constraints}')
        print(f'New Tips: {tips}')

if __name__ == '__main__':
    """Entry point of the script.

    Here we set the goal and call the main function.
    """
    goal = parse_arguments()
    main(goal)