import os
import subprocess
import datetime
import pexpect
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
        if command.startswith("cat << EOF >"):
            # Handle writing to a file using cat << EOF syntax
            file_path = command.split(">")[1].strip()
            file_content = ""
            
            # Find the position of the EOF marker
            eof_pos = command.find("EOF", len("cat << EOF >"))
            if eof_pos != -1:
                file_content = command[len("cat << EOF >")+len(file_path):eof_pos].strip()
            
            with open(os.path.join(self.directory, file_path), "w") as file:
                file.write(file_content)
            
            return f"File '{file_path}' created successfully."
        
        chained_commands = command.split('&&')
        output = ''
        for cmd in chained_commands:
            cmd = cmd.strip()
            if cmd.startswith("cd") and not cmd.startswith("cdk"):
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
                    child = pexpect.spawn(cmd, cwd=self.directory, env=env_vars)
                    child.timeout = 1800  # Set a timeout value of 30 minutes (adjust as needed)

                    while True:
                        try:
                            child.expect('\n')
                            current_output = child.before.decode('utf-8').strip()
                            output += current_output + '\n'
                            print(current_output)  # Print the output as it arrives
                        except pexpect.EOF:
                            break
                        except pexpect.TIMEOUT:
                            dialog = child.before.decode('utf-8').strip()
                            output += f"System Dialog: {dialog}\n"
                            response = input(dialog + " ")
                            child.sendline(response)

                    child.close()
                except pexpect.ExceptionPexpect:
                    result = subprocess.run(cmd, cwd=self.directory, env=env_vars, shell=True, capture_output=True, text=True)
                    current_output = result.stdout.strip() if result.returncode == 0 else result.stderr.strip()
                    output += current_output + '\n'

                if len(output) > MAX_OUTPUT_LENGTH:
                    return f"{output.strip()[:MAX_OUTPUT_LENGTH]} \n ###The rest of the response was truncated due to length####\n"

        return output.strip()