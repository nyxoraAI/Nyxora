import { loadConfig } from '../config/parser';
import { executeWithRetry } from '../utils/llmUtils';
import { episodicDB } from '../memory/episodic';
import { logger } from './reasoning';
import pc from 'picocolors';

export class HonchoDaemon {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 60 * 60 * 1000; // Run every hour

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Initial run after 5 minutes
    setTimeout(() => this.runAnalysis(), 5 * 60 * 1000);
    
    // Scheduled runs
    this.intervalId = setInterval(() => {
      this.runAnalysis();
    }, this.INTERVAL_MS);
    
    console.log(pc.magenta('[Honcho] Dialectic User Modeling daemon started.'));
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.isRunning = false;
    console.log(pc.magenta('[Honcho] Daemon stopped.'));
  }

  public async runAnalysis() {
    console.log(pc.magenta('[Honcho] Running dialectic user modeling...'));
    
    const sessions = logger.getSessions();
    if (sessions.length === 0) return;
    
    const allHistory = logger.getHistory(undefined, 100); // Get recent 100 messages
    if (allHistory.length < 5) return; // Not enough context
    
    const config = loadConfig();
    
    const prompt = `You are Honcho, Nyxora's background Persona Auditor.
Your task is to analyze the user's recent chat history and extract long-term persona traits, preferences, or behavioral rules.
Focus ONLY on facts about the user. (e.g. "User prefers high-risk trades", "User is a developer", "User wants concise answers", "User hates memecoins").

Output your findings as a strict JSON array of strings. If nothing new is found, return [].
Example: ["User avoids Ethereum mainnet due to gas", "User prefers dark mode"]

Chat History:
${allHistory.map((m: any) => `[${m.role}] ${m.content}`).join('\n')}
`;

    try {
      const response = await executeWithRetry(async (client) => {
        return await client.chat({
          model: config.llm.model,
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.1
        });
      });
      
      let content = response.message.content || '[]';
      
      // Clean markdown if any
      content = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      
      let traits: string[] = [];
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          traits = parsed;
        } else if (parsed.traits && Array.isArray(parsed.traits)) {
          traits = parsed.traits;
        }
      } catch (e) {
        console.error(pc.red('[Honcho] Failed to parse JSON traits'), content);
      }
      
      if (traits.length > 0) {
        traits.forEach(trait => {
          episodicDB.updatePersonaTrait(trait, 0.8, 'honcho');
          console.log(pc.magenta(`[Honcho] Discovered new trait: ${trait}`));
        });
      }
      
    } catch (e: any) {
      console.error(pc.red(`[Honcho] Analysis failed: ${e.message}`));
    }
  }
}

export const honchoDaemon = new HonchoDaemon();
