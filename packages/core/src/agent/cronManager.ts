import { Cron } from 'croner';
import { loadConfig } from '../config/parser';
import { sendPushNotification } from '../gateway/telegram';
import { randomUUID } from 'crypto';
import pc from 'picocolors';

export interface CronJob {
  id: string;
  expression: string;
  prompt: string;
  task: Cron;
  createdAt: number;
}

class CronManager {
  private jobs: Map<string, CronJob> = new Map();

  public addJob(expression: string, prompt: string, sessionId?: string): string {
    const id = randomUUID();
    
    // Validate expression
    try {
      new Cron(expression);
    } catch (e) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    const task = new Cron(expression, async () => {
      console.log(pc.cyan(`[Cron] Executing job ${id}: "${prompt}"`));
      try {
        // Dynamically import processUserInput to avoid circular dependencies
        const { processUserInput } = await import('./reasoning');
        
        // Execute the prompt as a background system task
        const response = await processUserInput(prompt, 'system', undefined, sessionId || `cron-${id}`);
        
        // Push notification to Telegram if configured
        const config = loadConfig();
        if (config.integrations?.telegram?.enabled && config.integrations?.telegram?.authorized_chat_id) {
          const message = `🤖 *AI Scheduled Report*\n\n${response}`;
          await sendPushNotification(config.integrations.telegram.authorized_chat_id, message);
        }
      } catch (err: any) {
        console.error(pc.red(`[Cron] Failed to execute job ${id}:`), err);
        const config = loadConfig();
        if (config.integrations?.telegram?.enabled && config.integrations?.telegram?.authorized_chat_id) {
          await sendPushNotification(config.integrations.telegram.authorized_chat_id, `⚠️ *Cron Job Error*\n\nPrompt: ${prompt}\nError: ${err.message}`);
        }
      }
    });

    this.jobs.set(id, {
      id,
      expression,
      prompt,
      task,
      createdAt: Date.now()
    });

    console.log(pc.green(`[Cron] Scheduled new job ${id} with expression '${expression}'`));
    return id;
  }

  public removeJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (job) {
      job.task.stop();
      this.jobs.delete(id);
      console.log(pc.yellow(`[Cron] Removed job ${id}`));
      return true;
    }
    return false;
  }

  public getJobs(): Omit<CronJob, 'task'>[] {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      expression: job.expression,
      prompt: job.prompt,
      createdAt: job.createdAt
    }));
  }
  
  public getActiveJobsCount(): number {
    return this.jobs.size;
  }
}

export const cronManager = new CronManager();
