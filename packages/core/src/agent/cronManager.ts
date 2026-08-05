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
  lastRunAt: number;
}

interface PersistedJob {
  id: string;
  expression: string;
  prompt: string;
  createdAt: number;
  lastRunAt?: number;
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
      createdAt: j.createdAt,
      lastRunAt: j.createdAt // Or we could track this explicitly in CronJob, but storing actual lastRunAt in the file is better
    }));
    // Note: since we rebuild the array from `jobs`, we should keep track of lastRunAt in CronJob as well.
    fs.writeFileSync(CRON_PERSIST_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(pc.red('[Cron] Failed to persist jobs:'), e);
  }
}

import { skillCurator } from './curator';

class CronManager {
  private jobs: Map<string, CronJob> = new Map();

  constructor() {
    // Restore jobs from disk on startup
    const persisted = loadPersistedJobs();
    if (persisted.length > 0) {
      console.log(pc.cyan(`[Cron] Restoring ${persisted.length} persisted job(s) from disk...`));
      for (const saved of persisted) {
        try {
          this._scheduleJob(saved.id, saved.expression, saved.prompt, saved.createdAt, saved.lastRunAt || saved.createdAt);
          console.log(pc.green(`[Cron] ✓ Restored job ${saved.id} (${saved.expression})`));
        } catch (e: any) {
          console.warn(pc.yellow(`[Cron] ✗ Skipped invalid job ${saved.id}: ${e.message}`));
        }
      }
    }

    // Run background maintenance
    skillCurator.runMaintenance();
  }

  private _scheduleJob(id: string, expression: string, prompt: string, createdAt: number, lastRunAt: number): void {
    // Validate expression first
    let cronInstance: Cron;
    try {
      cronInstance = new Cron(expression);
    } catch (e) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    // Advanced Catch-up Window Logic
    const expectedPrevious = cronInstance.previousRun();
    if (expectedPrevious && expectedPrevious.getTime() > lastRunAt) {
      console.log(pc.magenta(`[Cron] Catching up missed job ${id} (last run: ${new Date(lastRunAt).toISOString()})`));
      // Execute asynchronously to not block startup
      setTimeout(() => this._executeJob(id, prompt), 5000);
    }

    const task = new Cron(expression, () => {
      this._executeJob(id, prompt);
    });

    this.jobs.set(id, { id, expression, prompt, task, createdAt, lastRunAt });
  }

  private async _executeJob(id: string, prompt: string) {
    console.log(pc.cyan(`[Cron] Executing job ${id}: "${prompt}"`));
    try {
      const { processUserInput } = await import('./reasoning');
      const response = await processUserInput(prompt, 'system', undefined, `cron-${id}`);

      const job = this.jobs.get(id);
      if (job) {
        job.lastRunAt = Date.now();
        savePersistedJobs(this.jobs);
      }

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
  }



  public addJob(expression: string, prompt: string, sessionId?: string): string {
    const id = randomUUID();
    this._scheduleJob(id, expression, prompt, Date.now(), Date.now());
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
      createdAt: job.createdAt,
      lastRunAt: job.lastRunAt
    }));
  }

  public getActiveJobsCount(): number {
    return this.jobs.size;
  }
}

export const cronManager = new CronManager();
