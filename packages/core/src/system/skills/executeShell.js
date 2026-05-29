"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTerminalCommandToolDefinition = void 0;
exports.runTerminalCommand = runTerminalCommand;
const child_process_1 = require("child_process");
function runTerminalCommand(command) {
    return new Promise((resolve) => {
        (0, child_process_1.exec)(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            let output = "";
            if (stdout)
                output += `STDOUT:\n${stdout}\n`;
            if (stderr)
                output += `STDERR:\n${stderr}\n`;
            if (error)
                output += `ERROR:\n${error.message}\n`;
            if (!output)
                output = "Command executed successfully with no output.";
            resolve(output);
        });
    });
}
exports.runTerminalCommandToolDefinition = {
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
