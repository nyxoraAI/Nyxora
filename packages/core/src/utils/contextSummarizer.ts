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

/** How many text-only exchanges to keep verbatim before summarising older ones. */
const VERBATIM_TAIL = 10;
/** Minimum history length (user+assistant pairs) before we bother summarising. */
const SUMMARISE_THRESHOLD = 20;

/**
 * Returns a history array that fits in context.
 * If history is short, returns as-is.
 * If long, prepends a "Conversation Summary" system message and keeps the tail verbatim.
 */
export async function compressHistory(history: Message[]): Promise<Message[]> {
  const textMessages = history.filter(
    m => (m.role === 'user' || m.role === 'assistant') && m.content && !m.tool_calls
  );

  if (textMessages.length < SUMMARISE_THRESHOLD) {
    return history; // nothing to compress yet
  }

  // Split: old messages to summarise, recent tail to keep verbatim
  const tailMessages = textMessages.slice(-VERBATIM_TAIL);
  const oldMessages = textMessages.slice(0, -VERBATIM_TAIL);

  if (oldMessages.length === 0) return history;

  try {
    const config = loadConfig();
    const historyText = oldMessages
      .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
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

    // Return: summary as system note + verbatim tail + all tool messages (never drop tool messages)
    const toolMessages = history.filter(
      m => m.role === 'tool' || (m.role === 'assistant' && m.tool_calls)
    );

    return [
      {
        role: 'system' as any,
        content: `--- CONVERSATION SUMMARY (earlier context) ---\n${summaryText}\n--- END SUMMARY ---`
      },
      ...tailMessages,
      ...toolMessages.slice(-6) // keep last 6 tool interactions
    ];
  } catch (e) {
    // On failure, just return the tail — never crash the agent
    return history.slice(-VERBATIM_TAIL * 2);
  }
}

/**
 * Fast check — should we attempt compression?
 */
export function needsCompression(history: Message[]): boolean {
  const textCount = history.filter(
    m => (m.role === 'user' || m.role === 'assistant') && m.content && !m.tool_calls
  ).length;
  return textCount >= SUMMARISE_THRESHOLD;
}
