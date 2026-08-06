import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const runTestsAndFixToolDefinition = {
  type: "function",
  function: {
    name: "run_tests_and_fix",
    description: "Runs tests to identify failures for an autonomous test-fix loop. Does NOT auto-fix, but provides structured results to the agent.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Optional test command to run. If not provided, it will look for a test script in package.json."
        },
        maxIterations: {
          type: "number",
          description: "Maximum number of iterations. Default is 5."
        },
        workDir: {
          type: "string",
          description: "Working directory to run tests in."
        }
      }
    }
  }
};

export async function runTestsAndFix(args: { command?: string; maxIterations?: number; workDir?: string }): Promise<string> {
  const maxIter = args.maxIterations || 5;
  const workDir = args.workDir || process.cwd();
  
  if (!fs.existsSync(workDir)) {
    return `Error: Working directory does not exist: ${workDir}`;
  }

  let command = args.command;
  
  if (!command) {
    const pkgPath = path.join(workDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts && pkg.scripts.test) {
          command = 'npm test';
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    if (!command) {
      command = 'npm test'; // Fallback
    }
  }

  const nyxoraDir = path.join(os.homedir(), '.nyxora');
  if (!fs.existsSync(nyxoraDir)) {
    fs.mkdirSync(nyxoraDir, { recursive: true });
  }
  
  const stateFile = path.join(nyxoraDir, 'test_loop_state.json');
  let iteration = 1;
  
  if (fs.existsSync(stateFile)) {
    try {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      iteration = (state.iteration || 0) + 1;
    } catch (e) {
      iteration = 1;
    }
  }

  if (iteration > maxIter) {
    fs.unlinkSync(stateFile); // Reset for next time
    return `Status: MAX_ITERATIONS_REACHED\nTest loop reached maximum iterations (${maxIter}). Please review failures and escalate to the user.`;
  }

  fs.writeFileSync(stateFile, JSON.stringify({ iteration }));

  let outputText = '';
  try {
    // We run it through shell
    const result = spawnSync(command, { shell: true, cwd: workDir, encoding: 'utf8', timeout: 120000 });
    
    const output = (result.stdout || '') + '\n' + (result.stderr || '');
    const isSuccess = result.status === 0;

    // Simple parsing of output
    const passingMatch = output.match(/(\d+)\s+passing/i);
    const failingMatch = output.match(/(\d+)\s+failing/i);
    
    let passCount = passingMatch ? passingMatch[1] : '?';
    let failCount = failingMatch ? failingMatch[1] : (isSuccess ? '0' : '?');

    if (isSuccess && passCount === '?') passCount = 'All';

    outputText += `🧪 Test Results (Iteration ${iteration}/${maxIter})\n`;
    outputText += `✅ ${passCount} passing  ❌ ${failCount} failing\n\n`;

    if (isSuccess) {
      fs.unlinkSync(stateFile); // Reset on success
      outputText += `Status: DONE\nAll tests passed successfully!`;
    } else {
      outputText += `Failed Tests:\n`;
      // We do a heuristic extraction of failures if possible
      // This is a naive extraction for Jest/Mocha/Vitest-like output
      const lines = output.split('\n');
      let inFailureBlock = false;
      for (const line of lines) {
        if (line.match(/failing/i) || line.match(/failed/i) || line.match(/FAIL/)) {
            // Keep some context of failure lines
            outputText += `- ${line.trim()}\n`;
        }
      }
      outputText += `\n(See full logs for details if the above is insufficient)\n\n`;
      outputText += `Status: CONTINUE\n`;
    }
  } catch (error: any) {
    outputText = `Error running command: ${error.message}\nStatus: CONTINUE`;
  }

  return outputText;
}
