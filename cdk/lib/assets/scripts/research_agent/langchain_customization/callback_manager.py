from langchain.callbacks.base import BaseCallbackHandler

class CallbackManager(BaseCallbackHandler):
    """Class to manage callback methods for the program."""
    def __init__(self):
        """Initialize CallbackManager with empty last_execution list."""
        super().__init__()
        self.last_execution = []

    def on_llm_start(self, serialized, prompts, **kwargs):
        """Run when LLM starts."""
        super().on_llm_start(serialized, prompts, **kwargs)

    def on_llm_new_token(self, token, **kwargs):
        """Handle a new token from the Language Learning Model (LLM).
        Args:
            token (str): The new token received from the LLM.
        """
        super().on_llm_new_token(token, **kwargs)
        self.last_execution.append(token)

    def on_llm_end(self, response, **kwargs):
        """Run when LLM ends."""
        super().on_llm_end(response, **kwargs)

    def on_llm_error(self, error, **kwargs):
        """Run when LLM errors."""
        super().on_llm_error(error, **kwargs)

    def on_chain_start(self, serialized, inputs, **kwargs):
        """Run when chain starts."""
        super().on_chain_start(serialized, inputs, **kwargs)

    def on_chain_end(self, outputs, **kwargs):
        """Run when chain ends."""
        super().on_chain_end(outputs, **kwargs)

    def on_chain_error(self, error, **kwargs):
        """Run when chain errors."""
        super().on_chain_error(error, **kwargs)

    def on_tool_start(self, serialized, input_str, **kwargs):
        """Run when tool starts."""
        super().on_tool_start(serialized, input_str, **kwargs)

    def on_tool_end(self, output, **kwargs):
        """Run when tool ends."""
        super().on_tool_end(output, **kwargs)

    def on_tool_error(self, error, **kwargs):
        """Run when tool errors."""
        super().on_tool_error(error, **kwargs)

    def on_text(self, text, **kwargs):
        """Run on arbitrary text."""
        super().on_text(text, **kwargs)
        self.last_execution.append(text)

    def on_agent_action(self, action, **kwargs):
        """Run on agent action."""
        super().on_agent_action(action, **kwargs)

    def on_agent_finish(self, finish, **kwargs):
        """Run on agent end."""
        super().on_agent_finish(finish, **kwargs)