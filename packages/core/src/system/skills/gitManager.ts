import { exec } from 'child_process';
import { loadApiKeys } from '../../config/parser';

export async function executeGitCommand(action: string, commitMessage?: string): Promise<string> {
  return new Promise(async (resolve) => {
    // Failsafe: Prevent hanging on interactive prompts (e.g. password prompts)
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    
    // Check if a GitHub PAT is stored in config
    const keys = await loadApiKeys();
    const githubToken = keys['github_key'] || '';

    let command = '';
    
    if (action === 'status') {
      command = 'git status';
    } else if (action === 'add_all') {
      command = 'git add .';
    } else if (action === 'commit') {
      if (!commitMessage) return resolve("Error: commitMessage is required for action 'commit'");
      // Escape quotes
      const safeMsg = commitMessage.replace(/"/g, '\\"');
      command = `git commit -m "${safeMsg}"`;
    } else if (action === 'push') {
      if (githubToken) {
        // Find origin URL and inject token
        try {
          const remoteUrlObj = await new Promise<string>((res, rej) => {
            exec('git config --get remote.origin.url', (err, stdout) => {
              if (err) res('');
              else res(stdout.trim());
            });
          });
          
          if (remoteUrlObj && remoteUrlObj.startsWith('https://')) {
            const injectedUrl = remoteUrlObj.replace('https://', `https://${githubToken}@`);
            command = `git push ${injectedUrl}`;
          } else {
            command = 'git push';
          }
        } catch (e) {
          command = 'git push';
        }
      } else {
        command = 'git push';
      }
    } else {
      return resolve(`Error: Unsupported action '${action}'`);
    }

    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        if (stderr.includes('Authentication failed') || stderr.includes('could not read Username')) {
          return resolve(`Git Authentication Failed: Please set up your SSH keys, or run 'nyxora set-key github <PAT_TOKEN>' to use a Personal Access Token.`);
        }
        return resolve(`Git Error:\n${stderr || error.message}`);
      }
      return resolve(`Git Success:\n${stdout}`);
    });
  });
}

export const gitManagerToolDefinition = {
  type: "function",
  function: {
    name: "execute_git_command",
    description: "Executes version control (Git) commands to manage codebase changes.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["status", "add_all", "commit", "push"],
          description: "The git action to perform.",
        },
        commitMessage: {
          type: "string",
          description: "The commit message. Required only if action is 'commit'.",
        }
      },
      required: ["action"],
    },
  },
};
