import { createGoal, getAllGoals, pauseGoal, resumeGoal } from '../../agent/goalManager';

export const createLongTermGoalToolDefinition = {
  name: 'create_long_term_goal',
  description: 'Create a long-term multi-step goal that runs autonomously in the background.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the goal' },
      description: { type: 'string', description: 'Detailed description of what needs to be achieved' },
      steps: {
        type: 'array',
        items: { type: 'string' },
        description: 'An ordered list of steps to achieve the goal'
      },
      intervalMinutes: { type: 'number', description: 'How often to run the next step in minutes (default 60)' },
      sessionId: { type: 'string', description: 'The session ID to tie this goal to' }
    },
    required: ['title', 'description', 'steps']
  }
};

export const getLongTermGoalStatusToolDefinition = {
  name: 'get_goal_status',
  description: 'Get the status of all long-term autonomous goals.',
  parameters: { type: 'object', properties: {} }
};

export const pauseGoalToolDefinition = {
  name: 'pause_goal',
  description: 'Pause an active long-term goal.',
  parameters: {
    type: 'object',
    properties: {
      goalId: { type: 'string', description: 'The ID of the goal to pause' }
    },
    required: ['goalId']
  }
};

export const resumeGoalToolDefinition = {
  name: 'resume_goal',
  description: 'Resume a paused or failed long-term goal.',
  parameters: {
    type: 'object',
    properties: {
      goalId: { type: 'string', description: 'The ID of the goal to resume' }
    },
    required: ['goalId']
  }
};

export async function createLongTermGoal(args: any, context?: any) {
  const intervalMs = args.intervalMinutes ? args.intervalMinutes * 60 * 1000 : 60 * 60 * 1000;
  const sessionId = args.sessionId || context?.sessionId || 'default';
  const goal = createGoal(args.title, args.description, args.steps, sessionId, intervalMs);
  return `Goal created successfully! ID: ${goal.id}\nTitle: ${goal.title}\nSteps: ${goal.steps.length}`;
}

export async function getLongTermGoalStatus() {
  const goals = getAllGoals();
  if (goals.length === 0) return 'No goals found.';
  
  let result = '--- LONG-TERM GOALS ---\n';
  for (const g of goals) {
    const nextRun = new Date(g.nextRunAt).toLocaleString();
    result += `ID: ${g.id} | Status: ${g.status} | Step: ${g.currentStep}/${g.steps.length}\n`;
    result += `Title: ${g.title}\n`;
    result += `Next Run: ${nextRun}\n`;
    result += `---\n`;
  }
  return result;
}

export async function pauseGoalById(id: string) {
  pauseGoal(id);
  return `Goal ${id} has been paused.`;
}

export async function resumeGoalById(id: string) {
  resumeGoal(id);
  return `Goal ${id} has been resumed.`;
}
