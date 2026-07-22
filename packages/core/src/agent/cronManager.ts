import { Cron } from 'croner';
import { loadConfig } from '../config/parser';
import { sendPushNotification } from '../channels/telegram';
import { randomUUID } from 'crypto';
import pc from 'picocolors';
import fs from 'fs';
import { getPath } from '../config/paths';

export interface CronJob {
  id: string;
  expression: string;
  prompt: string;
  task: Cron;
  createdAt: number;
}

interface PersistedJob {
  id: string;
  expression: string;
  prompt: string;
  createdAt: number;
}

const CRON_PERSIST_FILE = getPath('cron_jobs.json');

function loadPersistedJobs(): PersistedJob[] {
  try {
    if (fs.existsSync(CRON_PERSIST_FILE)) {
      const raw = fs.readFileSync(CRON_PERSIST_FILE, 'utf-8');
      return JSON.parse(raw) as PersistedJob[];
    }
  } catch (e) {
    console.warn(pc.yellow('[Cron] Failed to load persisted jobs, starting fresh.'));
  }
  return [];
}

function savePersistedJobs(jobs: Map<string, CronJob>): void {
  try {
    const data: PersistedJob[] = Array.from(jobs.values()).map(j => ({
      id: j.id,
      expression: j.expression,
      prompt: j.prompt,
      createdAt: j.createdAt
    }));
    fs.writeFileSync(CRON_PERSIST_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(pc.red('[Cron] Failed to persist jobs:'), e);
  }
}

class CronManager {
  private jobs: Map<string, CronJob> = new Map();

  constructor() {
    // Restore jobs from disk on startup
    const persisted = loadPersistedJobs();
    if (persisted.length > 0) {
      console.log(pc.cyan(`[Cron] Restoring ${persisted.length} persisted job(s) from disk...`));
      for (const saved of persisted) {
        try {
          this._scheduleJob(saved.id, saved.expression, saved.prompt, saved.createdAt);
          console.log(pc.green(`[Cron] ✓ Restored job ${saved.id} (${saved.expression})`));
        } catch (e: any) {
          console.warn(pc.yellow(`[Cron] ✗ Skipped invalid job ${saved.id}: ${e.message}`));
        }
      }
    }
  }

  private _scheduleJob(id: string, expression: string, prompt: string, createdAt: number): void {
    // Validate expression first
    try {
      new Cron(expression);
    } catch (e) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    const task = new Cron(expression, async () => {
      console.log(pc.cyan(`[Cron] Executing job ${id}: "${prompt}"`));
      try {
        const { processUserInput } = await import('./reasoning');
        const response = await processUserInput(prompt, 'system', undefined, `cron-${id}`);

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

    this.jobs.set(id, { id, expression, prompt, task, createdAt });
  }

  public addJob(expression: string, prompt: string, sessionId?: string): string {
    const id = randomUUID();
    this._scheduleJob(id, expression, prompt, Date.now());
    savePersistedJobs(this.jobs);
    console.log(pc.green(`[Cron] Scheduled new job ${id} with expression '${expression}'`));
    return id;
  }

  public removeJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (job) {
      job.task.stop();
      this.jobs.delete(id);
      savePersistedJobs(this.jobs);
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
