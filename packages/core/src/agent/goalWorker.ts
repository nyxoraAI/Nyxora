import { Goal, getActiveGoals, advanceStep, markFailed, updateCheckpoint, markComplete } from './goalManager';
import { sendPushNotification } from '../channels/telegram';

export async function executeGoalStep(goal: Goal) {
  try {
    const prompt = `[GOAL WORKER] Goal: "${goal.title}" — Step ${goal.currentStep + 1}/${goal.steps.length}: ${goal.steps[goal.currentStep]}\n\nContext from previous steps:\n${goal.context || 'None yet.'}`;
    
    // Dynamic import to avoid circular dependency
    const { processUserInput } = await import('./reasoning');
    
    console.log(`[GoalWorker] Executing step for goal ${goal.id}...`);
    const result = await processUserInput(prompt, 'system', undefined, goal.sessionId);
    
    updateCheckpoint(goal.id, goal.context + '\n\nStep ' + (goal.currentStep+1) + ' result: ' + result.substring(0, 500));
    
    if (goal.currentStep + 1 >= goal.steps.length) {
      markComplete(goal.id);
      console.log(`[GoalWorker] Goal ${goal.id} complete.`);
      if (goal.sessionId.startsWith('telegram_')) {
        const chatId = parseInt(goal.sessionId.replace('telegram_', ''), 10);
        if (!isNaN(chatId)) {
          await sendPushNotification(chatId, `🎉 Goal Completed: "${goal.title}"\nFinal Step: ${goal.steps[goal.currentStep]}\n\nResult:\n${result.substring(0, 500)}...`);
        }
      }
    } else {
      advanceStep(goal.id);
      if (goal.sessionId.startsWith('telegram_')) {
        const chatId = parseInt(goal.sessionId.replace('telegram_', ''), 10);
        if (!isNaN(chatId)) {
          await sendPushNotification(chatId, `🔄 Goal Progress: "${goal.title}"\nCompleted Step ${goal.currentStep + 1}/${goal.steps.length}: ${goal.steps[goal.currentStep]}\n\nResult:\n${result.substring(0, 500)}...`);
        }
      }
    }
  } catch (error: any) {
    console.error(`[GoalWorker] Error executing goal ${goal.id}:`, error);
    markFailed(goal.id, error.message || 'Unknown error');
    if (goal.sessionId.startsWith('telegram_')) {
      const chatId = parseInt(goal.sessionId.replace('telegram_', ''), 10);
      if (!isNaN(chatId)) {
        await sendPushNotification(chatId, `⚠️ Goal Failed: "${goal.title}"\nFailed on Step ${goal.currentStep + 1}/${goal.steps.length}\nError: ${error.message}`);
      }
    }
  }
}

export function startGoalWorker(): void {
  // Run every 5 minutes
  setInterval(async () => {
    try {
      const activeGoals = getActiveGoals();
      for (const goal of activeGoals) {
        await executeGoalStep(goal);
      }
    } catch (e) {
      console.error('[GoalWorker] Interval error:', e);
    }
  }, 5 * 60 * 1000);
  
  // Also run immediately on start after 30s delay (give services time to init)
  setTimeout(async () => {
    try {
      const activeGoals = getActiveGoals();
      for (const goal of activeGoals) {
        await executeGoalStep(goal);
      }
    } catch (e) {
      console.error('[GoalWorker] Initial delay error:', e);
    }
  }, 30_000);
}
