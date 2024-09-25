import os
import asyncio
import base64
from typing import List, Optional, TypedDict
from langchain_core.messages import BaseMessage, SystemMessage
from playwright.async_api import async_playwright, Page
from langchain import hub
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_aws import ChatBedrockConverse
from langgraph.graph import END, StateGraph
from langchain_core.runnables import RunnableLambda
from langchain_core.runnables import chain as chain_decorator

# Define types and classes
class BBox(TypedDict):
    x: float
    y: float
    text: str
    type: str
    ariaLabel: str

class Prediction(TypedDict):
    action: str
    args: Optional[List[str]]

class AgentState(TypedDict):
    page: Page
    input: str
    img: str
    bboxes: List[BBox]
    prediction: Prediction
    scratchpad: List[BaseMessage]
    observation: str

# Load the JavaScript for marking the page
with open("mark_page.js") as f:
    mark_page_script = f.read()

@chain_decorator
async def mark_page(page):
    # First, evaluate the script to define the functions
    await page.evaluate(mark_page_script)
    
    bboxes = None
    for _ in range(10):
        try:
            # Now try to call markPage()
            bboxes = await page.evaluate("markPage()")
            break
        except Exception:
            # May be loading...
            await asyncio.sleep(3)
    
    if bboxes is None:
        raise Exception("Failed to mark page after multiple attempts")

    screenshot = await page.screenshot()
    
    # Ensure the bboxes don't follow us around
    # Only try to unmark if markPage() succeeded
    if bboxes is not None:
        try:
            await page.evaluate("unmarkPage()")
        except Exception as e:
            print(f"Warning: Failed to unmark page: {e}")
    
    return {
        "img": base64.b64encode(screenshot).decode(),
        "bboxes": bboxes,
    }

# Define tools
async def click(state: AgentState):
    # - Click [Numerical_Label]
    page = state["page"]
    click_args = state["prediction"]["args"]
    if click_args is None or len(click_args) != 1:
        return f"Failed to click bounding box labeled as number {click_args}"
    bbox_id = click_args[0]
    bbox_id = int(bbox_id)
    try:
        bbox = state["bboxes"][bbox_id]
    except Exception:
        return f"Error: no bbox for : {bbox_id}"
    x, y = bbox["x"], bbox["y"]
    await page.mouse.click(x, y)
    # TODO: In the paper, they automatically parse any downloaded PDFs
    # We could add something similar here as well and generally
    # improve response format.
    return f"Clicked {bbox_id}"

async def type_text(state: AgentState):
    page = state["page"]
    type_args = state["prediction"]["args"]
    if type_args is None or len(type_args) != 2:
        return (
            f"Failed to type in element from bounding box labeled as number {type_args}"
        )
    bbox_id = type_args[0]
    bbox_id = int(bbox_id)
    bbox = state["bboxes"][bbox_id]
    x, y = bbox["x"], bbox["y"]
    text_content = type_args[1]
    await page.mouse.click(x, y)
    # Check if MacOS
    select_all = "Meta+A" if platform.system() == "Darwin" else "Control+A"
    await page.keyboard.press(select_all)
    await page.keyboard.press("Backspace")
    await page.keyboard.type(text_content)
    await page.keyboard.press("Enter")
    return f"Typed {text_content} and submitted"


async def scroll(state: AgentState):
    page = state["page"]
    scroll_args = state["prediction"]["args"]
    if scroll_args is None or len(scroll_args) != 2:
        return "Failed to scroll due to incorrect arguments."

    target, direction = scroll_args

    if target.upper() == "WINDOW":
        # Not sure the best value for this:
        scroll_amount = 500
        scroll_direction = (
            -scroll_amount if direction.lower() == "up" else scroll_amount
        )
        await page.evaluate(f"window.scrollBy(0, {scroll_direction})")
    else:
        # Scrolling within a specific element
        scroll_amount = 200
        target_id = int(target)
        bbox = state["bboxes"][target_id]
        x, y = bbox["x"], bbox["y"]
        scroll_direction = (
            -scroll_amount if direction.lower() == "up" else scroll_amount
        )
        await page.mouse.move(x, y)
        await page.mouse.wheel(0, scroll_direction)

    return f"Scrolled {direction} in {'window' if target.upper() == 'WINDOW' else 'element'}"


async def wait(state: AgentState):
    sleep_time = 5
    await asyncio.sleep(sleep_time)
    return f"Waited for {sleep_time}s."


async def go_back(state: AgentState):
    page = state["page"]
    await page.go_back()
    return f"Navigated back a page to {page.url}."


async def to_google(state: AgentState):
    page = state["page"]
    await page.goto("https://www.google.com/")
    return "Navigated to google.com."

async def annotate(state):
    marked_page = await mark_page.with_retry().ainvoke(state["page"])
    return {**state, **marked_page}

def format_descriptions(state):
    labels = []
    for i, bbox in enumerate(state["bboxes"]):
        text = bbox.get("ariaLabel") or ""
        if not text.strip():
            text = bbox["text"]
        el_type = bbox.get("type")
        labels.append(f'{i} (<{el_type}/>): "{text}"')
    bbox_descriptions = "\nValid Bounding Boxes:\n" + "\n".join(labels)
    return {**state, "bbox_descriptions": bbox_descriptions}

import re

def parse(text: str) -> dict:
    action_prefix = "Action: "
    action_pattern = r'Action: (.+)$'
    
    match = re.search(action_pattern, text, re.DOTALL)
    if not match:
        return {"action": None, "args": None}
    
    action_block = match.group(1).strip()
    
    # Split action and args
    split_output = action_block.split(None, 1)
    action = split_output[0]
    action_input = split_output[1] if len(split_output) > 1 else None

    # Special handling for ANSWER action
    if action == "ANSWER":
        if action_input and action_input.startswith(';'):
            action_input = [action_input[1:].strip()]
        else:
            action_input = [action_input]
    elif action_input is not None:
        action_input = [inp.strip().strip("[]") for inp in action_input.split(";")]
    
    return {"action": action, "args": action_input}

# Set up LLM and agent
llm = ChatBedrockConverse(
    model="anthropic.claude-3-5-sonnet-20240620-v1:0",
    temperature=0,
    max_tokens=None,
)

prompt = hub.pull("wfh/web-voyager")

agent = annotate | RunnablePassthrough.assign(
    prediction=format_descriptions | prompt | llm | StrOutputParser() | parse
)

def update_scratchpad(state: AgentState):
    """After a tool is invoked, we want to update
    the scratchpad so the agent is aware of its previous steps"""
    old = state.get("scratchpad")
    if old:
        txt = old[0].content
        last_line = txt.rsplit("\n", 1)[-1]
        step = int(re.match(r"\d+", last_line).group()) + 1
    else:
        txt = "Previous action observations:\n"
        step = 1
    txt += f"\n{step}. {state['observation']}"

    return {**state, "scratchpad": [SystemMessage(content=txt)]}


graph_builder = StateGraph(AgentState)

graph_builder = StateGraph(AgentState)


graph_builder.add_node("agent", agent)
graph_builder.set_entry_point("agent")

graph_builder.add_node("update_scratchpad", update_scratchpad)
graph_builder.add_edge("update_scratchpad", "agent")

tools = {
    "Click": click,
    "Type": type_text,
    "Scroll": scroll,
    "Wait": wait,
    "GoBack": go_back,
    "Google": to_google,
}


for node_name, tool in tools.items():
    graph_builder.add_node(
        node_name,
        # The lambda ensures the function's string output is mapped to the "observation"
        # key in the AgentState
        RunnableLambda(tool) | (lambda observation: {"observation": observation}),
    )
    # Always return to the agent (by means of the update-scratchpad node)
    graph_builder.add_edge(node_name, "update_scratchpad")


def select_tool(state: AgentState):
    # Any time the agent completes, this function
    # is called to route the output to a tool or
    # to the end user.
    action = state["prediction"]["action"]
    if action == "ANSWER":
        return END
    if action == "retry":
        return "agent"
    return action

graph_builder.add_conditional_edges("agent", select_tool)

graph = graph_builder.compile()

# Main function to run the agent
async def run_agent(question: str, max_steps: int = 150):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://www.google.com")

        event_stream = graph.astream(
            {
                "page": page,
                "input": question,
                "scratchpad": [],
            },
            {
                "recursion_limit": max_steps,
            },
        )
        final_answer = None
        async for event in event_stream:
            if "agent" not in event:
                continue
            pred = event["agent"].get("prediction") or {}
            action = pred.get("action")
            if "ANSWER" in action:
                final_answer = pred.get("args")[0]
                break

        await browser.close()
        return final_answer

# Entry point for AWS Batch
def lambda_handler(event, context):
    question = event['question']
    result = asyncio.run(run_agent(question))
    return {
        'statusCode': 200,
        'body': result
    }

# For local testing
if __name__ == "__main__":
    question = "What are the latest blog posts from langchain?"
    result = asyncio.run(run_agent(question))
    print(f"Final response: {result}")