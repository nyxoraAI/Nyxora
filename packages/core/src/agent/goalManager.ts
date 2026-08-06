import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getPath } from '../config/paths';

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'paused' | 'complete' | 'failed';
  steps: string[];
  currentStep: number;
  sessionId: string;
  context: string;
  createdAt: number;
  lastRunAt: number;
  nextRunAt: number;
  intervalMs: number;
  failureCount: number;
  maxFailures: number;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_FAILURES = 3;

export class GoalManager {
  private goals: Map<string, Goal> = new Map();
  private goalsFilePath: string;

  constructor() {
    let dataDir = '';
    try {
      dataDir = getPath('data');
    } catch (e) {
      dataDir = path.join(os.homedir(), '.nyxora', 'data');
    }
    
    if (!fs.existsSync(dataDir)) {
      dataDir = path.join(os.homedir(), '.nyxora');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }
    
    this.goalsFilePath = path.join(dataDir, 'goals.json');
    this.loadGoals();
  }

  private loadGoals() {
    try {
      if (fs.existsSync(this.goalsFilePath)) {
        const raw = fs.readFileSync(this.goalsFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const goal of parsed) {
            this.goals.set(goal.id, goal);
          }
        }
      }
    } catch (e) {
      console.error('[GoalManager] Failed to load goals:', e);
    }
  }

  private saveGoals() {
    try {
      const data = Array.from(this.goals.values());
      fs.writeFileSync(this.goalsFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[GoalManager] Failed to save goals:', e);
    }
  }

  public createGoal(
    title: string,
    description: string,
    steps: string[],
    sessionId: string,
    intervalMs: number = DEFAULT_INTERVAL_MS
  ): Goal {
    const id = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
    const now = Date.now();
    const goal: Goal = {
      id,
      title,
      description,
      status: 'active',
      steps,
      currentStep: 0,
      sessionId,
      context: '',
      createdAt: now,
      lastRunAt: 0,
      nextRunAt: now,
      intervalMs,
      failureCount: 0,
      maxFailures: MAX_FAILURES
    };

    this.goals.set(id, goal);
    this.saveGoals();
    return goal;
  }

  public getGoal(id: string): Goal | undefined {
    return this.goals.get(id);
  }

  public getActiveGoals(): Goal[] {
    const now = Date.now();
    return Array.from(this.goals.values()).filter(
      (g) => g.status === 'active' && g.nextRunAt <= now
    );
  }

  public getAllGoals(): Goal[] {
    return Array.from(this.goals.values());
  }

  public updateCheckpoint(id: string, context: string): void {
    const goal = this.goals.get(id);
    if (goal) {
      goal.context = context;
      this.saveGoals();
    }
  }

  public advanceStep(id: string): void {
    const goal = this.goals.get(id);
    if (goal) {
      goal.currentStep += 1;
      goal.failureCount = 0;
      goal.lastRunAt = Date.now();
      goal.nextRunAt = Date.now() + goal.intervalMs;
      this.saveGoals();
    }
  }

  public markComplete(id: string): void {
    const goal = this.goals.get(id);
    if (goal) {
      goal.status = 'complete';
      this.saveGoals();
    }
  }

  public markFailed(id: string, reason: string): void {
    const goal = this.goals.get(id);
    if (goal) {
      goal.failureCount += 1;
      goal.context += `\nError: ${reason}`;
      if (goal.failureCount >= goal.maxFailures) {
        goal.status = 'failed';
      } else {
        goal.lastRunAt = Date.now();
        goal.nextRunAt = Date.now() + goal.intervalMs;
      }
      this.saveGoals();
    }
  }

  public pauseGoal(id: string): void {
    const goal = this.goals.get(id);
    if (goal && goal.status === 'active') {
      goal.status = 'paused';
      this.saveGoals();
    }
  }

  public resumeGoal(id: string): void {
    const goal = this.goals.get(id);
    if (goal && (goal.status === 'paused' || goal.status === 'failed')) {
      goal.status = 'active';
      goal.failureCount = 0;
      goal.nextRunAt = Date.now();
      this.saveGoals();
    }
  }

  public deleteGoal(id: string): void {
    if (this.goals.has(id)) {
      this.goals.delete(id);
      this.saveGoals();
    }
  }

  public getGoalSummary(): string {
    const active = Array.from(this.goals.values()).filter(g => g.status === 'active');
    if (active.length === 0) return '';
    
    let summary = '--- 🎯 ACTIVE LONG-TERM GOALS ---\n';
    for (const goal of active) {
      const stepInfo = `Step ${goal.currentStep + 1}/${goal.steps.length}`;
      const nextRun = new Date(goal.nextRunAt).toISOString();
      summary += `- [${goal.id}] "${goal.title}" (${stepInfo}) | Next Run: ${nextRun}\n`;
    }
    return summary;
  }
}

export const goalManager = new GoalManager();

export const createGoal = (...args: Parameters<typeof goalManager.createGoal>) => goalManager.createGoal(...args);
export const getGoal = (...args: Parameters<typeof goalManager.getGoal>) => goalManager.getGoal(...args);
export const getActiveGoals = () => goalManager.getActiveGoals();
export const getAllGoals = () => goalManager.getAllGoals();
export const updateCheckpoint = (...args: Parameters<typeof goalManager.updateCheckpoint>) => goalManager.updateCheckpoint(...args);
export const advanceStep = (...args: Parameters<typeof goalManager.advanceStep>) => goalManager.advanceStep(...args);
export const markComplete = (...args: Parameters<typeof goalManager.markComplete>) => goalManager.markComplete(...args);
export const markFailed = (...args: Parameters<typeof goalManager.markFailed>) => goalManager.markFailed(...args);
export const pauseGoal = (...args: Parameters<typeof goalManager.pauseGoal>) => goalManager.pauseGoal(...args);
export const resumeGoal = (...args: Parameters<typeof goalManager.resumeGoal>) => goalManager.resumeGoal(...args);
export const deleteGoal = (...args: Parameters<typeof goalManager.deleteGoal>) => goalManager.deleteGoal(...args);
export const getGoalSummary = () => goalManager.getGoalSummary();
