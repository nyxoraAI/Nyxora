import { loadConfig } from '../config/parser';
import { executeWithRetry } from '../utils/llmUtils';
import { episodicDB } from '../memory/episodic';
import { logger } from './reasoning';
import pc from 'picocolors';

export class NyxDaemon {
  private isProcessing = false;
  private interval: NodeJS.Timeout | null = null;
  private initialTimeout: NodeJS.Timeout | null = null;

  public start() {
    if (this.interval) return;
    
    // Initial run after 5 minutes
    this.initialTimeout = setTimeout(() => {
      this.runAudit();
    }, 5 * 60 * 1000);
    
    // Audit memory every 30 minutes
    this.interval = setInterval(() => {
      this.runAudit();
    }, 30 * 60 * 1000);
    
    console.log(pc.magenta('[Nyx] Dialectic User Modeling daemon started.'));
  }

  public stop() {
    if (this.initialTimeout) {
      clearTimeout(this.initialTimeout);
      this.initialTimeout = null;
    }
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log(pc.magenta('[Nyx] Daemon stopped.'));
    }
  }

  private async runAudit() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      console.log(pc.magenta('[Nyx] Running dialectic user modeling...'));
      
      // Fix A: Use getRecentMessagesAllSessions so Telegram/Discord history is included.
      // Previously getHistory(undefined) only read session_id IS NULL — Telegram sessions have a session_id.
      const history = logger.getRecentMessagesAllSessions(30);

      // Fix B: Filter noise — only send plain user & assistant text messages to the LLM.
      // Skip tool messages, system messages, and assistant entries that only contain tool_calls.
      const conversationOnly = history.filter(m =>
        (m.role === 'user' || m.role === 'assistant') &&
        m.content &&
        m.content.trim().length > 0 &&
        !m.tool_calls
      );

      if (conversationOnly.length < 5) {
        console.log(pc.magenta('[Nyx] Not enough conversation messages to analyze, skipping.'));
        this.isProcessing = false;
        return;
      }
      
      const config = loadConfig();
      
      const prompt = `You are Nyx, Nyxora's background Persona Auditor.
Analyze the following recent conversation between the USER and Nyxora.
Identify any persistent user traits, behavioral preferences, trading styles, AND language preferences.
Output your findings AS A STRICT JSON ARRAY of strings. If no strong traits are found, output an empty array [].
Examples of valid traits:
- Behavior: "Prefers concise answers", "Aggressive trader", "Risk-averse", "Polite", "Often trades on Arbitrum"
- Language: "Primarily speaks Indonesian", "Uses English for technical terms", "Communicates in casual/informal tone", "Mixes Indonesian and English (code-switching)"
IMPORTANT: Always include a language preference trait if the user's language or communication style is identifiable.
DO NOT output markdown, just the JSON array.`;

      const messages = conversationOnly
        .map((m: any) => `${m.role === 'user' ? 'USER' : 'NYXORA'}: ${m.content}`)
        .join('\n');


      const response = await executeWithRetry(async (client) => {
        return await client.chat({
          model: config.llm.model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: messages }
          ],
          temperature: 0.2
        });
      });
      
      let content = response.message.content || '[]';
      
      // Clean markdown if any
      content = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      
      try {
        const traits = JSON.parse(content);
        if (Array.isArray(traits) && traits.length > 0) {
          for (const trait of traits) {
            // Fix C: Start confidence at 0.4 (not 0.8) so traits build up gradually across audits.
            // updatePersonaTrait has upsert logic: repeated traits gain +0.4 * 0.2 per audit cycle.
            episodicDB.updatePersonaTrait(trait, 0.4, 'nyx_daemon');
            console.log(pc.magenta(`[Nyx] Discovered new trait: ${trait}`));
          }
        }
      } catch (e) {
        console.error(pc.red('[Nyx] Failed to parse JSON traits'), content);
      }
      
    } catch (e: any) {
      console.error(pc.red(`[Nyx] Analysis failed: ${e.message}`));
    } finally {
      this.isProcessing = false;
    }
  }
}

export const nyxDaemon = new NyxDaemon();
