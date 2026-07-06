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
    
    // Initial run after 30 seconds (faster persona availability for new sessions)
    this.initialTimeout = setTimeout(() => {
      this.runAudit();
    }, 30 * 1000);
    
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
      // Kirim riwayat percakapan ke Python ML Engine untuk diproses oleh LangChain
      const res = await fetch('http://127.0.0.1:8000/cognitive/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationOnly })
      });

      if (!res.ok) {
        throw new Error(`Python ML Engine returned ${res.status}: ${await res.text()}`);
      }

      const traits = await res.json();
      
      try {
        if (traits && typeof traits === 'object' && !Array.isArray(traits)) {
          const categories = ['language', 'tone', 'trading_style', 'behavior'] as const;
          for (const cat of categories) {
            const value = traits[cat];
            if (value && typeof value === 'string' && value.trim()) {
              // Category-based upsert: confidence accumulates correctly per category
              episodicDB.upsertPersonaByCategory(cat, value.trim(), 0.5, 'nyx_daemon');
              console.log(pc.magenta(`[Nyx] Updated persona [${cat}]: ${value.trim()}`));
            }
          }
        } else {
          console.log(pc.magenta('[Nyx] No strong traits found in this audit cycle.'));
        }
      } catch (e: any) {
        console.error(pc.red('[Nyx] Failed to process traits from Python: ' + e.message), traits);
      }
      
    } catch (e: any) {
      console.error(pc.red(`[Nyx] Analysis failed: ${e.message}`));
    } finally {
      this.isProcessing = false;
    }
  }
}

export const nyxDaemon = new NyxDaemon();
