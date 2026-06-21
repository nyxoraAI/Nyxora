import { cronManager } from '../../agent/cronManager';

export const cancelTaskDefinition = {
  type: "function",
  function: {
    name: "cancel_task",
    description: "Cancel a scheduled background task (cron job). Use this when the user asks you to stop monitoring or cancel a previously scheduled task.",
    parameters: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "The unique Job ID of the scheduled task to cancel."
        }
      },
      required: ["jobId"]
    }
  }
};

export async function executeCancelTask(args: any): Promise<string> {
  const { jobId } = args;
  
  if (!jobId) {
    return "Error: Missing required parameter jobId.";
  }

  try {
    const success = cronManager.removeJob(jobId);
    if (success) {
      return `Success! I have cancelled the scheduled background task with Job ID: ${jobId}.`;
    } else {
      return `Failed to cancel task. No active task found with Job ID: ${jobId}. You can check active jobs by asking me what tasks are currently running.`;
    }
  } catch (error: any) {
    return `Failed to cancel task: ${error.message}`;
  }
}
