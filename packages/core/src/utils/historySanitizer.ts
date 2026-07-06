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
        // Strip tool calls from history for Gemini to prevent 400 Bad Request bugs
        msg.content = msg.content || `[Executed external tools: ${m.tool_calls.map((tc: any) => tc.function?.name).join(', ')}]`;
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
        // Convert orphaned or stripped tool results to user messages
        msg.role = 'user'; 
        msg.content = `[Past Tool Result for ${m.name}]:\n${m.content || ""}`;
        delete msg.tool_call_id;
        delete msg.name;
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
