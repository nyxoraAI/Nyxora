import { exec } from 'child_process';
import { loadConfig, loadApiKeys } from '../../config/parser';

export async function runTerminalCommand(command: string, cwd?: string, envType: 'local' | 'docker' = 'local', dockerImage: string = 'python:3.11-slim'): Promise<string> {
  // --- AUTO-REDIRECT TO PTY FOR SUDO ---
  // If command starts with sudo but was called via non-PTY tool, auto-redirect to PTY
  const needsSudo = /^\s*sudo\s/.test(command);
  if (needsSudo) {
    // Check if password is configured or passwordless sudo is available
    try {
      const config = loadConfig();
      const sudoPassword = (config as any).security?.sudo_password;
      
      // If password configured, strongly recommend PTY
      if (sudoPassword) {
        return `[TOOL SELECTION ERROR]\nThis command requires sudo and you have a password configured.\n\nPlease use run_terminal_command_pty instead of run_terminal_command for sudo commands.\n\nCommand: ${command}\n\n[AUTO-SUGGESTION] Try again with: run_terminal_command_pty`;
      }
    } catch (e) {
      // Config load failed, continue with normal execution
    }
  }

  // Load API keys to inject into the shell environment for Playbooks (e.g. Notion, GitHub)
  const keys = await loadApiKeys().catch(() => ({}));
  const env = { ...process.env };
  
  for (const [k, v] of Object.entries(keys)) {
    if (v) {
      env[k.toUpperCase()] = v;
      if (k === 'notion_key') env.NOTION_API_KEY = v;
      if (k === 'github_key') env.GITHUB_TOKEN = v;
    }
  }

  return new Promise((resolve) => {
    // --- SUDO AUTO-INJECTION ---
    // If command requires sudo, inject password from config via sudo -S
    let finalCommand = command;
    const needsSudo = /^\s*sudo\s/.test(command);
    if (needsSudo) {
      try {
        const config = loadConfig();
        const sudoPassword = (config as any).security?.sudo_password;
        if (sudoPassword) {
          // Inject password via stdin using echo | sudo -S
          const escaped = sudoPassword.replace(/'/g, "'\\''");
          finalCommand = command.replace(/^\s*sudo\s/, `echo '${escaped}' | sudo -S `);
        }
      } catch (e) {
        // config load failed, proceed without password injection
      }
    }

    if (envType === 'docker') {
      // Escape single quotes for bash -c
      const escapedCommand = finalCommand.replace(/'/g, "'\\''");
      const cwdArg = cwd ? `-w ${cwd}` : '';
      const volumeArg = cwd ? `-v ${cwd}:${cwd}` : '';
      finalCommand = `docker run --rm ${cwdArg} ${volumeArg} ${dockerImage} bash -c '${escapedCommand}'`;
    }

    exec(finalCommand, { maxBuffer: 1024 * 1024 * 10, env, cwd, timeout: 120000 }, (error, stdout, stderr) => {
      let output = "";
      if (stdout) output += `STDOUT:\n${stdout}\n`;

      // Filter out the sudo password prompt noise from stderr
      const filteredStderr = stderr
        ? stderr.split('\n').filter(l => !l.includes('[sudo] password for')).join('\n').trim()
        : '';
      if (filteredStderr) output += `STDERR:\n${filteredStderr}\n`;
      if (error) output += `ERROR:\n${error.message}\n`;

      if (!output) output = "Command executed successfully with no output.";

      // If sudo failed due to missing password, give a helpful hint
      if (needsSudo && (output.includes('sudo: a password is required') || output.includes('no password supplied'))) {
        output += `\n[NYXORA HINT] To allow Nyxora to run sudo commands automatically, add the following to your ~/.nyxora/config.yaml:\n  security:\n    sudo_password: YOUR_SUDO_PASSWORD\nAlternatively, run this command yourself in a terminal: ${command}`;
      }

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
    description: "Execute NON-INTERACTIVE shell commands. Support local and docker isolated environments. Use this for: simple commands (ls, cat, grep, ps), pipes/redirects, background processes. DO NOT use for: sudo commands (use run_terminal_command_pty instead), interactive editors (vim, nano), or interactive programs.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The terminal command to execute.",
        },
        envType: {
          type: "string",
          enum: ["local", "docker"],
          description: "The execution environment. Use 'docker' for isolated/sandboxed operations, 'local' for host operations.",
        },
        dockerImage: {
          type: "string",
          description: "If envType is 'docker', specify the image to use (e.g. 'python:3.11-slim' or 'ubuntu:latest'). Default is 'python:3.11-slim'.",
        }
      },
      required: ["command"],
    },
  },
};
