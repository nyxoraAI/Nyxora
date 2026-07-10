/**
 * Context Summarizer — P6: Prevent Context Window Overflow
 *
 * When conversation history grows too long, summarise older messages
 * into a compact paragraph and return a trimmed history that fits
 * within a safe token budget. Mirrors the approach used by Claude/GPT
 * to maintain long-running session coherence.
 */
import { executeWithRetry } from './llmUtils';
import { loadConfig } from '../config/parser';
import pc from 'picocolors';

export interface Message {
  role: string;
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

const VERBATIM_TAIL = 20;
const SUMMARISE_THRESHOLD = 40;

const compressionCache = new Map<string, { textCount: number; compressed: Message[] }>();

export async function compressHistory(history: Message[], sessionId?: string): Promise<Message[]> {
  if (history.length < SUMMARISE_THRESHOLD) {
    return history;
  }

  if (sessionId) {
    const cached = compressionCache.get(sessionId);
    // FIX: Invalidate cache if ANY message is added to history, including tool calls
    if (cached && cached.textCount === history.length) {
      return cached.compressed;
    }
  }

  // FIX: Keep the tail strictly chronological so LLM doesn't get confused
  const tailMessages = history.slice(-VERBATIM_TAIL);
  const oldMessages = history.slice(0, -VERBATIM_TAIL);

  if (oldMessages.length === 0) return history;

  try {
    const config = loadConfig();
    const historyText = oldMessages
      .map(m => {
        let name = m.role.toUpperCase();
        let content = m.content || '';
        if (m.role === 'assistant' && m.tool_calls) content = `[Called tools: ${m.tool_calls.map(tc => tc.function.name).join(', ')}]`;
        if (m.role === 'tool') content = `[Tool Result: ${m.name}]`;
        return `${name}: ${content}`;
      })
      .join('\n');

    const summaryRes = await executeWithRetry(async (client) =>
      client.chat({
        model: config.llm.model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `You are a conversation summarizer. Summarize the following conversation exchange into a single concise paragraph (max 200 words). 
Focus on: key decisions made, important facts established, user preferences expressed, and task outcomes. 
Write in third person. Be factual, not narrative.`
          },
          { role: 'user', content: historyText }
        ]
      })
    );

    const summaryText = summaryRes.message?.content?.trim() || '';
    if (!summaryText) return history;

    console.log(pc.magenta(`[ContextSummarizer] Compressed ${oldMessages.length} old messages into summary.`));

    const compressed: Message[] = [
      {
        role: 'system' as any,
        content: `--- CONVERSATION SUMMARY (earlier context) ---\n${summaryText}\n--- END SUMMARY ---`
      },
      ...tailMessages
    ];

    if (sessionId) {
      compressionCache.set(sessionId, { textCount: history.length, compressed });
    }

    return compressed;
  } catch (e) {
    return history.slice(-VERBATIM_TAIL * 2);
  }
}

export function needsCompression(history: Message[]): boolean {
  return history.length >= SUMMARISE_THRESHOLD;
}
