import { loadConfig } from '../config/parser';
import { getEstimatedMaxContext } from './llmUtils';

export function sanitizeHistoryForLLM(history: any[], activeTools: any[], provider: string = 'openai'): any[] {
  const activeToolNames = activeTools.map(t => t.function?.name || t.name);
  
  // PASS 1: Collect all available tool response IDs
  const availableToolResponseIds = new Set<string>();
  for (const m of history) {
    if ((m.role === 'tool' || m.tool_call_id) && m.tool_call_id) {
      availableToolResponseIds.add(m.tool_call_id);
    }
  }

  const config = loadConfig();
  const maxContext = (config.llm as any).max_context || getEstimatedMaxContext(config.llm.model);
  const dynamicMaxChars = Math.floor((maxContext * 4) * 0.4);

  const keptToolCallIds = new Set<string>();
  const processedHistory: any[] = [];

  for (const m of history) {
    let role = m.role;
    // Only convert system → user for NON-summary system messages.
    // Summary messages (from contextSummarizer) must STAY as 'system' role
    // so the LLM treats them as background context, not as user instructions.
    if (role === 'system') {
      const contentStr = typeof m.content === 'string' ? m.content : '';
      const isSummary = contentStr.includes('[CONVERSATION SUMMARY') 
        || contentStr.includes('BACKGROUND CONTEXT ONLY')
        || contentStr.includes('[PREVIOUS ATTEMPT');
      if (!isSummary) {
        role = 'user';
      }
      // If it IS a summary, keep role as 'system'.
    }
    let content = m.content || "";

    if (typeof content === 'string') {
      if (role === 'assistant') {
        content = content.replace(/No response generated\.\s*(---)?\s*/g, '').trim();
      }
      // Scrub ANSI escape codes and control characters to prevent LLM JSON parser crashes from old corrupted history
      content = content
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          block.text = block.text
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        }
      }
    }

    let msg: any = {
      role,
      content
    };
    if (m.name !== undefined && m.name !== null) msg.name = m.name;
    if (m.tool_call_id !== undefined && m.tool_call_id !== null) msg.tool_call_id = m.tool_call_id;
    if (role === 'assistant' && m.reasoning_content !== undefined && m.reasoning_content !== null) {
      msg.reasoning_content = m.reasoning_content;
    }
    
    if (m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls.filter((tc: any) => 
            activeToolNames.includes(tc.function?.name) && availableToolResponseIds.has(tc.id)
        );
        if (msg.tool_calls.length === 0) {
            delete msg.tool_calls;
            msg.content = msg.content || `[Executed external tools]`;
        } else {
            msg.tool_calls.forEach((tc: any) => { if (tc.id) keptToolCallIds.add(tc.id); });
        }
    }

    if (m.role === 'tool' || m.tool_call_id) {
      if (!keptToolCallIds.has(m.tool_call_id)) {
        // Convert tool result to user message with the ACTUAL result content.
        msg.role = 'user'; 
        
        if (Array.isArray(m.content)) {
          // Multimodal Array from computerUse
          let textPart = `[Tool Result: ${m.name || 'tool'}]\n`;
          let images: any[] = [];
          
          for (const block of m.content) {
            if (block.type === 'text') textPart += block.text + '\n';
            else if (block.type === 'image_url') images.push(block.image_url.url);
          }
          
          if (provider.includes('anthropic') || provider.includes('claude')) {
            msg.content = [{ type: 'text', text: textPart }];
            for (const b64 of images) {
              const bData = b64.replace(/^data:image\/[a-z]+;base64,/, '');
              msg.content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: bData } });
            }
          } else if (provider.includes('gemini') || provider.includes('google')) {
            msg.content = [{ type: 'text', text: textPart }];
            for (const b64 of images) {
              msg.content.push({ type: 'image_url', image_url: { url: b64 } });
            }
          } else {
             // OpenAI or Local (9router)
             msg.content = [{ type: 'text', text: textPart }];
             for (const b64 of images) {
                msg.content.push({ type: 'image_url', image_url: { url: b64 } });
             }
          }
        } else {
          // Normal String Tool Result
          let resultPreview = m.content || '';
          if (typeof resultPreview === 'string' && resultPreview.length > dynamicMaxChars) {
             const head = Math.floor(dynamicMaxChars * 0.3);
             const tail = Math.floor(dynamicMaxChars * 0.7);
             resultPreview = resultPreview.substring(0, head) + `\n\n... [Content Truncated: ${resultPreview.length - dynamicMaxChars} chars omitted] ...\n\n` + resultPreview.substring(resultPreview.length - tail);
          }
          msg.content = `[Tool Result: ${m.name || 'tool'}]\n${resultPreview}`;
        }
        
        delete msg.tool_call_id;
        delete msg.name;
      } else {
        // GLOBAL TOOL OUTPUT TRUNCATION (Anti-Context Overflow)
        if (typeof msg.content === 'string' && msg.content.length > dynamicMaxChars) {
          const head = Math.floor(dynamicMaxChars * 0.3);
          const tail = Math.floor(dynamicMaxChars * 0.7);
          msg.content = msg.content.substring(0, head) + 
            `\n\n... [Content Truncated: ${msg.content.length - dynamicMaxChars} chars omitted to prevent LLM context overflow] ...\n\n` + 
            msg.content.substring(msg.content.length - tail);
        }
      }
    }

    processedHistory.push(msg);
  }

  // Remove orphaned tool responses at the start of the history window
  while (processedHistory.length > 0 && processedHistory[0].role === 'tool') {
    processedHistory.shift();
  }

  // ── Merge consecutive user messages ────────────────────────────────────────
  // Root cause: compressHistory emits a system summary that we convert to 'user'
  // above (role === 'system' → 'user'). If head[0] is also a user message, or
  // pruneLoopedHistory stacked multiple user summaries, we end up with back-to-back
  // user turns — which strict providers (Claude, Gemini) silently reject, causing
  // the LLM to produce NO response at all.
  // Fix: fold any consecutive user messages into a single message.
  const merged: any[] = [];
  for (const msg of processedHistory) {
    const prev = merged[merged.length - 1];
    if (msg.role === 'user' && prev?.role === 'user') {
      // Merge into previous user message
      if (typeof prev.content === 'string' && typeof msg.content === 'string') {
        prev.content = prev.content + '\n\n---\n\n' + msg.content;
      } else {
        // Gabungkan elemen array (multimodal) agar konteks sebelumnya tidak terhapus
        const prevContent = Array.isArray(prev.content) ? prev.content : [{ type: 'text', text: String(prev.content) }];
        const msgContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: String(msg.content) }];
        prev.content = [...prevContent, ...msgContent];
      }
    } else {
      merged.push(msg);
    }
  }

  // ── Global Context Truncation (Emergency Override) ─────────────────────
  // If the total characters of `merged` exceed maxContext * 4 * 0.8, we must forcefully
  // drop older messages to prevent the 400 Context Length Exceeded error.
  const absoluteMaxChars = Math.floor(maxContext * 4 * 0.8);
  let totalChars = 0;
  for (const m of merged) {
    totalChars += typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length;
    if (m.tool_calls) totalChars += JSON.stringify(m.tool_calls).length;
  }

  if (totalChars > absoluteMaxChars && merged.length > 1) {
    let dropCount = 0;
    // Keep dropping oldest messages until we are under the limit,
    // but ALWAYS protect the system prompt (index 0) if it exists.
    let dropIndex = (merged.length > 1 && merged[0].role === 'system') ? 1 : 0;
    
    while (totalChars > absoluteMaxChars && merged.length > (dropIndex + 1)) {
      const msgToDrop = merged[dropIndex];
      const charsToDrop = typeof msgToDrop.content === 'string' ? msgToDrop.content.length : JSON.stringify(msgToDrop.content).length;
      totalChars -= charsToDrop;
      if (msgToDrop.tool_calls) totalChars -= JSON.stringify(msgToDrop.tool_calls).length;
      merged.splice(dropIndex, 1);
      dropCount++;
    }
    console.warn(`[HistorySanitizer] Dropped ${dropCount} older messages to enforce absolute context limit (${maxContext} tokens).`);
  }

  // ── FINAL FALLBACK: Extreme Message Truncation ──────────────────────────
  // If we STILL exceed limits (e.g. because a single user prompt or array-based tool result is massive),
  // we forcefully slice the strings inside the messages to guarantee no crash.
  for (const m of merged) {
    if (typeof m.content === 'string' && m.content.length > absoluteMaxChars) {
      const tail = Math.floor(absoluteMaxChars * 0.9);
      m.content = m.content.substring(0, absoluteMaxChars - tail) + "\n\n...[CRITICAL SYSTEM TRUNCATION: CONTENT TOO LARGE]...\n\n" + m.content.substring(m.content.length - tail);
    } else if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === 'text' && typeof block.text === 'string' && block.text.length > absoluteMaxChars) {
          const tail = Math.floor(absoluteMaxChars * 0.9);
          block.text = block.text.substring(0, absoluteMaxChars - tail) + "\n\n...[CRITICAL SYSTEM TRUNCATION: CONTENT TOO LARGE]...\n\n" + block.text.substring(block.text.length - tail);
        }
      }
    }
  }

  return merged;
}

/**
 * pruneLoopedHistory — collapses failed/looped tool call runs into compact summaries.
 *
 * Problem: after a loop-break fires (⚠️ Loop breaker / [System Anti-Loop]), all the failed
 * tool call attempts stay in the session history. On the next user request in the same session,
 * the LLM sees the noise and gets confused → repeats the bad pattern again.
 *
 * Fix: scan for "runs" (user → assistant+tool_calls → ... → loop-break-assistant).
 * Replace each failed run with a single compact [PREVIOUS ATTEMPT SUMMARY] user message.
 */
export function pruneLoopedHistory(history: any[]): any[] {
  if (!history || history.length === 0) return history;

  // Markers that indicate a run ended in failure/loop-break
  const LOOP_MARKERS = [
    '⚠️ Loop breaker',
    '[System Anti-Loop]',
    'LOOP DETECTED',
    'I stopped myself from repeating',
    'Loop breaker:',
  ];

  const isLoopBreak = (msg: any): boolean => {
    if (!msg || msg.role !== 'assistant') return false;
    const c = typeof msg.content === 'string' ? msg.content : '';
    return LOOP_MARKERS.some(m => c.includes(m));
  };

  // Walk through and find user-message indices to segment runs
  const result: any[] = [];
  let i = 0;

  while (i < history.length) {
    const msg = history[i];

    // Start of a user-triggered run
    if (msg.role === 'user') {
      // Collect everything until the next user message (or end)
      const runStart = i;
      let j = i + 1;
      while (j < history.length && history[j].role !== 'user') {
        j++;
      }
      const run = history.slice(runStart, j);

      // Check if this run contains a loop-break at any point
      const hasLoopBreak = run.some(isLoopBreak);

      if (hasLoopBreak) {
        // Extract what the user asked
        const userText = typeof msg.content === 'string'
          ? msg.content.substring(0, 200)
          : '[user request]';

        // Extract any successful tool results before things went bad
        const toolResults: string[] = [];
        for (const m of run) {
          if ((m.role === 'tool' || m.tool_call_id) && m.content) {
            const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            if (!c.includes('[System Anti-Loop]') && !c.includes('LOOP DETECTED')) {
              toolResults.push(c.substring(0, 300));
            }
          }
        }

        const summary = toolResults.length > 0
          ? `[PREVIOUS ATTEMPT — User asked: "${userText}". Tool execution encountered repeated failures and was stopped. Partial results: ${toolResults.join(' | ').substring(0, 500)}. Do NOT retry this action unless explicitly asked again.]`
          : `[PREVIOUS ATTEMPT — User asked: "${userText}". This request failed with repeated tool errors and was stopped. Do NOT retry unless explicitly asked again.]`;

        // Use 'system' role so LLM treats this as context, not as a user request to retry.
        result.push({ role: 'system', content: summary });
        // Skip the entire failed run
        i = j;
      } else {
        // Clean run — keep as-is
        result.push(...run);
        i = j;
      }
    } else {
      // Shouldn't happen at the top level, but push anyway
      result.push(msg);
      i++;
    }
  }

  return result;
}
