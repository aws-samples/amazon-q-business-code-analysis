import os
import subprocess
import datetime
import sys

# Get the current minute
current_minute = datetime.datetime.now().strftime("%Y%m%d%H%M")
# Create the directory path based on the current minute
DEFAULT_DIRECTORY = f"/tmp/ai2bash/playground/{current_minute}/"
MAX_OUTPUT_LENGTH = 10000000
env_vars = os.environ.copy()

class BashTool:
    """A class to encapsulate the functionality of running bash commands."""
    def __init__(self, directory=DEFAULT_DIRECTORY):
        """Initialize BashTool with the given directory.
        Args:
            directory (str): The directory to run bash commands in.
        """
        self.directory = directory
        if not os.path.exists(self.directory):
            os.makedirs(self.directory)

    def run_command(self, command: str) -> str:
        """Run a bash command and returns its output.
        Args:
            command (str): The command to run in bash.
        Returns:
            str: The output of the bash command.
        """
        chained_commands = command.split('&&')
        output = ''
        for cmd in chained_commands:
            cmd = cmd.strip()
            if cmd.startswith("cd "):
                new_directory = cmd[3:].strip()
                if new_directory == "..":
                    self.directory = os.path.dirname(self.directory)
                else:
                    potential_directory = os.path.join(self.directory, new_directory)
                    if os.path.exists(potential_directory) and os.path.isdir(potential_directory):
                        self.directory = potential_directory
                    else:
                        return "Error: Directory not found."
            else:
                try:
                    # Execute the command
                    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True, cwd=self.directory, env=env_vars)
                    stdout, stderr = result.stdout, result.stderr
                    output += stdout + stderr
                    # CalledProcessError
                except subprocess.CalledProcessError as e:
                    return f"Error: {e.stderr}"

                if len(output) > MAX_OUTPUT_LENGTH:
                    return f"{output.strip()[:MAX_OUTPUT_LENGTH]} \n ###The rest of the response was truncated due to length####\n"

        return output.strip()