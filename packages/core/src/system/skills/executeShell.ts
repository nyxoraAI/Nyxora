import { exec } from 'child_process';

export function runTerminalCommand(command: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      let output = "";
      if (stdout) output += `STDOUT:\n${stdout}\n`;
      if (stderr) output += `STDERR:\n${stderr}\n`;
      if (error) output += `ERROR:\n${error.message}\n`;
      
      if (!output) output = "Command executed successfully with no output.";
      
      // --- OUTPUT REDACTION LAYER ---
      
      // 1. Secret Exfiltration Redaction (Keys, Mnemonics, UUIDs, EVM/Solana Keys)
      const secretPatterns = [
        /BEGIN (RSA|OPENSSH|EC)? ?PRIVATE KEY/gi,
        /MNEMONIC/gi,
        /SEED PHRASE/gi,
        /AWS_SECRET_ACCESS_KEY/gi,
        /OPENAI_API_KEY/gi,
        /\b[a-fA-F0-9]{64,128}\b/g, // EVM Hex / auth.token / runtime.token
        /\b[1-9A-HJ-NP-Za-km-z]{80,100}\b/g, // Solana Keys
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g // UUIDs / defi_keys
      ];
      
      secretPatterns.forEach(pattern => {
        output = output.replace(pattern, '[REDACTED_SECRET]');
      });

      // 2. Sensitive Path Redaction (Blind the AI from knowing these paths exist)
      const sensitivePathPatterns = [
        /(?:\/.+)?\/\.ssh(?:\/.*)?/gi,
        /(?:\/.+)?\/\.gnupg(?:\/.*)?/gi,
        /(?:\/.+)?\/\.aws(?:\/.*)?/gi,
        /(?:\/.+)?\/\.config\/solana(?:\/.*)?/gi,
        /(?:\/.+)?\/\.ethereum(?:\/.*)?/gi,
        /(?:\/.+)?\/\.foundry(?:\/.*)?/gi,
        /(?:\/.+)?\/\.wallets(?:\/.*)?/gi,
        /(?:\/.+)?\/\.nyxora\/(?:auth|config|run)(?:\/.*)?/gi
      ];

      sensitivePathPatterns.forEach(pattern => {
        output = output.replace(pattern, '[REDACTED_SENSITIVE_PATH]');
      });

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
