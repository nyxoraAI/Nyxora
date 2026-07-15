import { cronManager } from '../../agent/cronManager';

export const scheduleTaskDefinition = {
  type: "function",
  function: {
    name: "schedule_task",
    description: "Schedule a recurring background task for the AI to execute automatically using a cron expression. Use this when the user asks you to remind them or monitor something periodically (e.g. 'check price every hour', 'monitor my wallet every 5 minutes'). The AI will execute the provided prompt at the scheduled interval and send the result via Telegram notification.",
    parameters: {
      type: "object",
      properties: {
        cronExpression: {
          type: "string",
          description: "A standard 5-field cron expression (minute hour day month day-of-week). Examples: '*/5 * * * *' (every 5 mins), '0 * * * *' (every hour), '0 8 * * *' (every day at 8 AM)."
        },
        prompt: {
          type: "string",
          description: "The prompt/command that the AI should execute when the cron triggers. E.g., 'What is the current price of Ethereum?'"
        },
        languageContext: {
          type: "string",
          description: "Optional. The specific language constraint for the AI's response (e.g., 'Reply strictly in Indonesian informal style', 'Reply in Japanese'). Infer this automatically from the user's current conversation language."
        }
      },
      required: ["cronExpression", "prompt"]
    }
  }
};

export async function executeScheduleTask(args: any): Promise<string> {
  const { cronExpression, prompt, languageContext } = args;
  
  if (!cronExpression || !prompt) {
    return "Error: Missing required parameters cronExpression or prompt.";
  }

  try {
    const finalPrompt = languageContext ? `${prompt}\n(System Context: ${languageContext})` : prompt;
    const jobId = cronManager.addJob(cronExpression, finalPrompt);
    return `Success! I have scheduled the background task.\nJob ID: ${jobId}\nSchedule: ${cronExpression}\nPrompt to execute: "${prompt}"\n\nYou will receive a notification via Telegram every time this task completes.`;
  } catch (error: any) {
    return `Failed to schedule task: ${error.message}. Please ensure the cron expression is valid.`;
  }
}
