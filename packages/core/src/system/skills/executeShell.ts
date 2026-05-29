import { exec } from 'child_process';

export function runTerminalCommand(command: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      let output = "";
      if (stdout) output += `STDOUT:\n${stdout}\n`;
      if (stderr) output += `STDERR:\n${stderr}\n`;
      if (error) output += `ERROR:\n${error.message}\n`;
      
      if (!output) output = "Command executed successfully with no output.";
      resolve(output);
    });
  });
}

export const runTerminalCommandToolDefinition = {
  type: "function",
  function: {
    name: "run_terminal_command",
    description: "Executes a shell/terminal command on the user's host machine. Use this to install packages, run scripts, manage processes, etc.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The terminal command to execute.",
        }
      },
      required: ["command"],
    },
  },
};
