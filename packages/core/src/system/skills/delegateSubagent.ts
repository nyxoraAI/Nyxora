import crypto from 'crypto';
import pc from 'picocolors';

export async function delegateSubagent(task: string, roleName: string = 'Subagent'): Promise<string> {
  const subagentSessionId = `subagent-${crypto.randomUUID()}`;
  console.log(pc.cyan(`[🤖 Spawning Subagent] ID: ${subagentSessionId} | Role: ${roleName}`));
  console.log(pc.dim(`Task: ${task}`));

  try {
    // Dynamic import to avoid circular dependency with osAgent -> pluginManager
    const { processOsIntent } = await import('../../agent/osAgent');
    
    // Inject the task as a user intent to the new subagent
    const result = await processOsIntent(
      `[SUBAGENT INSTRUCTION: ${roleName}]\nYou have been spawned as an isolated subagent to perform the following task. Complete it fully and return the final result.\n\nTASK:\n${task}`,
      'user',
      undefined,
      subagentSessionId
    );
    
    console.log(pc.cyan(`[🤖 Subagent Completed] ID: ${subagentSessionId}`));
    return `[SUBAGENT RESULT - ${roleName}]\n${result}`;
  } catch (error: any) {
    console.error(pc.red(`[❌ Subagent Failed] ID: ${subagentSessionId} | Error: ${error.message}`));
    return `[SUBAGENT ERROR]\nFailed to execute task: ${error.message}`;
  }
}

export const delegateSubagentToolDefinition = {
  type: "function",
  function: {
    name: "delegate_subagent",
    description: "Spawn an isolated subagent to perform a complex, multi-step task in parallel. The subagent will run independently and return its final result. Useful for breaking down large problems, parallelizing independent tasks, or preventing context window exhaustion.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "A highly detailed, self-contained prompt describing the exact task the subagent needs to perform.",
        },
        roleName: {
          type: "string",
          description: "A short descriptive name for this subagent's role (e.g., 'Code Reviewer', 'Research Assistant').",
        }
      },
      required: ["task", "roleName"],
    },
  },
};
