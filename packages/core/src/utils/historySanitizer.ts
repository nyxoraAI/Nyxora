export function sanitizeHistoryForLLM(history: any[], activeTools: any[], provider: string = 'openai'): any[] {
  const activeToolNames = activeTools.map(t => t.function?.name || t.name);
  const keptToolCallIds = new Set<string>();
  const processedHistory: any[] = [];

  for (const m of history) {
    let role = m.role === 'system' ? 'user' : m.role;
    let content = m.content || "";

    if (role === 'assistant' && content) {
      content = content.replace(/No response generated\.\s*(---)?\s*/g, '').trim();
    }

    let msg: any = { ...m, role, content };
    
    if (m.tool_calls && m.tool_calls.length > 0) {
      if (provider === 'gemini') {
        // FIX: For Gemini, we can't pass tool_calls in history directly (causes 400 error),
        // but we MUST NOT silently delete this context. Convert to informative text so the
        // LLM knows it already executed tools and what they returned.
        // Without this, the LLM hallucinates completion of tasks it never ran.
        const toolSummary = m.tool_calls.map((tc: any) => {
          const name = tc.function?.name || 'unknown_tool';
          const argsStr = tc.function?.arguments ? tc.function.arguments.substring(0, 100) : '{}';
          return `${name}(${argsStr})`;
        }).join(', ');
        msg.content = msg.content || `[Tools executed: ${toolSummary}]`;
        delete msg.tool_calls;
      } else {
        // Preserve tool calls for OpenAI/Anthropic, but filter inactive ones
        msg.tool_calls = m.tool_calls.filter((tc: any) => activeToolNames.includes(tc.function?.name));
        if (msg.tool_calls.length === 0) {
            delete msg.tool_calls;
            msg.content = msg.content || `[Executed external tools]`;
        } else {
            msg.tool_calls.forEach((tc: any) => { if (tc.id) keptToolCallIds.add(tc.id); });
        }
      }
    }

    if (m.role === 'tool' || m.tool_call_id) {
      if (provider === 'gemini' || !keptToolCallIds.has(m.tool_call_id)) {
        // FIX: Convert tool result to user message with the ACTUAL result content.
        // This preserves what the tool returned so LLM can reference it.
        const isLocalModel = provider === '9router' || provider === 'ollama' || provider === 'custom_provider';
        const maxChars = isLocalModel ? 4000 : 15000;
        let resultPreview = m.content || '';
        if (resultPreview.length > maxChars) {
           const head = Math.floor(maxChars * 0.3);
           const tail = Math.floor(maxChars * 0.7);
           resultPreview = resultPreview.substring(0, head) + `\n\n... [Content Truncated: ${resultPreview.length - maxChars} chars omitted] ...\n\n` + resultPreview.substring(resultPreview.length - tail);
        }
        msg.role = 'user'; 
        msg.content = `[Tool Result: ${m.name || 'tool'}]\n${resultPreview}`;
        delete msg.tool_call_id;
        delete msg.name;
      } else {
        // GLOBAL TOOL OUTPUT TRUNCATION (Anti-Context Overflow)
        const isLocalModel = provider === '9router' || provider === 'ollama' || provider === 'custom_provider';
        const MAX_TOOL_CHARS = isLocalModel ? 4000 : 15000;
        if (msg.content && msg.content.length > MAX_TOOL_CHARS) {
          const head = Math.floor(MAX_TOOL_CHARS * 0.3);
          const tail = Math.floor(MAX_TOOL_CHARS * 0.7);
          msg.content = msg.content.substring(0, head) + 
            `\n\n... [Content Truncated: ${msg.content.length - MAX_TOOL_CHARS} chars omitted to prevent LLM context overflow] ...\n\n` + 
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

  return processedHistory;
}
