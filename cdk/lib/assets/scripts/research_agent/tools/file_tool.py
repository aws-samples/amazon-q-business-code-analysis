import os
import datetime

# Get the current minute
current_minute = datetime.datetime.now().strftime("%Y%m%d%H%M")
# Create the directory path based on the current minute
DEFAULT_DIRECTORY = f"/tmp/ai2bash/playground/{current_minute}/"

class FileTool:
    """A class to encapsulate the functionality of writing to files."""

    def __init__(self, directory=DEFAULT_DIRECTORY):
        """Initialize FileTool with the given directory.

        Args:
            directory (str): The directory to write files in.
        """
        self.directory = directory
        if not os.path.exists(self.directory):
            os.makedirs(self.directory)

    def write_file(self, data):
        """Useful to write a file to a given path with a given content. 
        The input to this tool should be a pipe (|) separated text 
        of length two, representing the full path of the file, 
        including the /workdir/template, and the React 
        Component code content you want to write to it.
        For example, `./Keynote/src/components/Hero.jsx|REACT_COMPONENT_CODE_PLACEHOLDER`.
        Replace REACT_COMPONENT_CODE_PLACEHOLDER with the actual 
        code you want to write to the file."""
        # try:
        path, content = data.split("|", maxsplit=1)
        # Set path to add the default directory if not present
        if not path.startswith("/"):
            path = os.path.join(self.directory, path)
        # If path does not exist, create it
        if not os.path.exists(os.path.dirname(path)):
            os.makedirs(os.path.dirname(path))
        with open(path, "w") as f:
            f.write(content)
        return f"File written to {path}."
        # except Exception as :
            # return "Error with the input format for the tool."