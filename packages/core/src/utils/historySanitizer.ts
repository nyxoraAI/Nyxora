export function sanitizeHistoryForLLM(history: any[], activeTools: any[]): any[] {
  const activeToolNames = activeTools.map(t => t.function?.name || t.name);
  const strippedToolCallIds = new Set<string>();
  const processedHistory: any[] = [];

  for (const m of history) {
    let role = m.role === 'system' ? 'user' : m.role;
    let msg: any = { role, content: m.content || "" };
    
    if (m.name) msg.name = m.name;

    if (m.tool_calls && m.tool_calls.length > 0) {
      // Unconditionally strip tool calls from history to prevent Gemini 400 Bad Request bugs
      // (Gemini crashes if content is empty or tool schemas mismatch)
      msg.content = msg.content || `[Executed external tools: ${m.tool_calls.map((tc: any) => tc.function?.name).join(', ')}]`;
      m.tool_calls.forEach((tc: any) => {
        if (tc.id) strippedToolCallIds.add(tc.id);
      });
    }

    if (m.role === 'tool' || m.tool_call_id) {
      // Always convert past tool results to user messages to maintain a safe, text-only history
      msg.role = 'user'; 
      msg.content = `[Past Tool Result for ${m.name}]:\n${m.content || ""}`;
      delete msg.tool_call_id;
      delete msg.name;
    }

    processedHistory.push(msg);
  }

  // Remove orphaned tool responses at the start of the history window
  while (processedHistory.length > 0 && processedHistory[0].role === 'tool') {
    processedHistory.shift();
  }

  return processedHistory;
}
