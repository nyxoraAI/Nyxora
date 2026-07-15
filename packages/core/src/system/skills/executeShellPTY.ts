import { spawn } from 'child_process';
import { loadConfig, loadApiKeys } from '../../config/parser';
import * as pty from 'node-pty';

/**
 * Execute shell command with PTY support for interactive programs.
 * Use this for commands that require TTY (sudo with password prompt, interactive CLI tools).
 */
export async function runTerminalCommandPTY(command: string, autoSudoPassword?: string, cwd?: string): Promise<string> {
  // Load API keys to inject into environment
  const keys = await loadApiKeys().catch(() => ({}));
  const env = { ...process.env };
  
  for (const [k, v] of Object.entries(keys)) {
    if (v) {
      env[k.toUpperCase()] = v;
      if (k === 'notion_key') env.NOTION_API_KEY = v;
      if (k === 'github_key') env.GITHUB_TOKEN = v;
    }
  }

  return new Promise((resolve, reject) => {
    let output = '';
    let passwordSent = false;

    // Spawn with PTY (pseudo-terminal)
    const ptyProcess = pty.spawn('bash', ['-c', command], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: cwd || process.cwd(),
      env: env as any
    });

    // Capture all output
    ptyProcess.onData((data: string) => {
      output += data;

      // Auto-respond to sudo password prompt
      // Support multiple sudo prompt formats:
      // - "[sudo] password for user:"
      // - "[sudo: authenticate] Password:"
      // - "Password:"
      const isSudoPrompt = !passwordSent && (
        data.includes('[sudo] password for') ||
        data.includes('[sudo: authenticate]') ||
        (data.toLowerCase().includes('password:') && data.includes('sudo'))
      );
      
      if (isSudoPrompt) {
        if (autoSudoPassword) {
          console.log('[PTY] Sudo prompt detected, injecting password (from parameter)');
          ptyProcess.write(autoSudoPassword + '\r');
          passwordSent = true;
        } else {
          // Try to load from config
          try {
            const config = loadConfig();
            const configPassword = (config as any).security?.sudo_password;
            if (configPassword) {
              console.log('[PTY] Sudo prompt detected, injecting password from config');
              ptyProcess.write(configPassword + '\r');
              passwordSent = true;
            } else {
              console.warn('[PTY] Sudo prompt detected but no password in config.security.sudo_password');
            }
          } catch (e) {
            console.error('[PTY] Failed to load config for password injection:', e);
          }
        }
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      // Clean ANSI escape codes for LLM readability
      const cleanOutput = output
        .replace(/\x1b\[[0-9;]*m/g, '') // Remove color codes
        .replace(/\r\n/g, '\n')          // Normalize line endings
        .trim();

      if (exitCode === 0) {
        resolve(cleanOutput || 'Command executed successfully.');
      } else {
        resolve(`Command exited with code ${exitCode}:\n${cleanOutput}`);
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      ptyProcess.kill();
      resolve(`Command timeout after 30 seconds:\n${output}`);
    }, 30000);
  });
}

export const runTerminalCommandPTYToolDefinition = {
  type: "function",
  function: {
    name: "run_terminal_command_pty",
    description: "Execute INTERACTIVE shell commands with PTY (pseudo-terminal) support. ALWAYS use this for: 1) ANY command with 'sudo' (auto password injection), 2) interactive editors (vim, nano, emacs), 3) interactive programs (python REPL, irb, node), 4) programs that check for TTY. Do NOT use for simple non-interactive commands (ls, cat, grep) - use run_terminal_command instead (faster).",
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
