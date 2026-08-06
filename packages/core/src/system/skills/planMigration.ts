import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const planMigrationToolDefinition = {
  type: "function",
  function: {
    name: "plan_migration",
    description: "Creates a migration plan by finding affected files. Does NOT execute the migration.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Description of the migration."
        },
        targetGlob: {
          type: "string",
          description: "Optional glob pattern or keyword to search for affected files."
        },
        workDir: {
          type: "string",
          description: "Working directory to scan."
        }
      },
      required: ["description"]
    }
  }
};

export async function planMigration(args: { description: string; targetGlob?: string; workDir?: string }): Promise<string> {
  const workDir = args.workDir || process.cwd();
  
  if (!fs.existsSync(workDir)) {
    return `Error: Working directory does not exist: ${workDir}`;
  }

  let files: string[] = [];
  
  if (args.targetGlob) {
    try {
      // Use grep to find affected files based on the pattern
      const grepCmd = `grep -rl "${args.targetGlob}" . --exclude-dir=node_modules --exclude-dir=.git`;
      const result = spawnSync(grepCmd, { shell: true, cwd: workDir, encoding: 'utf8', timeout: 120000 });
      
      if (result.stdout) {
        files = result.stdout.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      }
    } catch (e) {
      // ignore
    }
  }

  let planText = `📋 Migration Plan: ${args.description}\n\n`;
  
  if (files.length > 0) {
    planText += `Found ${files.length} affected files:\n`;
    files.forEach((f, i) => {
      planText += `${i + 1}. ${f} — matches target pattern "${args.targetGlob}"\n`;
    });
  } else {
    planText += `Found 0 affected files directly matching the criteria.\n`;
  }
  
  planText += `\nRecommended approach:\n`;
  planText += `- Migrate in this order: Module by module\n`;
  planText += `- Test gate: run tests every 10 files\n`;
  planText += `- Estimated steps: ${files.length > 0 ? files.length : 'Unknown'}\n\n`;
  planText += `To start: work through files in order above, one at a time.\n`;
  planText += `Use todo_write to track progress.\n`;
  planText += `Use run_tests_and_fix after each module.\n`;

  return planText;
}
