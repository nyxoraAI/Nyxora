export function sanitizeHistoryForLLM(history: any[], activeTools: any[], provider: string = 'openai'): any[] {
  const activeToolNames = activeTools.map(t => t.function?.name || t.name);
  const keptToolCallIds = new Set<string>();
  const processedHistory: any[] = [];

  for (const m of history) {
    let role = m.role === 'system' ? 'user' : m.role;
    let content = m.content || "";

    if (role === 'assistant' && typeof content === 'string') {
      content = content.replace(/No response generated\.\s*(---)?\s*/g, '').trim();
    }

    let msg: any = { ...m, role, content };
    
    if (m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls.filter((tc: any) => activeToolNames.includes(tc.function?.name));
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
            // Wait, Gemini via Langchain/Official SDK handles inlineData, 
            // but in Nyxora's NormalizedChatRequest, GeminiAdapter converts OpenAI schema `image_url` to `inlineData`!
            // Let's use OpenAI schema as the universal base for Nyxora's NormalizedChatRequest
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
          const isLocalModel = provider === '9router' || provider === 'ollama' || provider === 'custom_provider';
          const maxChars = isLocalModel ? 4000 : 15000;
          let resultPreview = m.content || '';
          if (typeof resultPreview === 'string' && resultPreview.length > maxChars) {
             const head = Math.floor(maxChars * 0.3);
             const tail = Math.floor(maxChars * 0.7);
             resultPreview = resultPreview.substring(0, head) + `\n\n... [Content Truncated: ${resultPreview.length - maxChars} chars omitted] ...\n\n` + resultPreview.substring(resultPreview.length - tail);
          }
          msg.content = `[Tool Result: ${m.name || 'tool'}]\n${resultPreview}`;
        }
        
        delete msg.tool_call_id;
        delete msg.name;
      } else {
        // GLOBAL TOOL OUTPUT TRUNCATION (Anti-Context Overflow)
        const isLocalModel = provider === '9router' || provider === 'ollama' || provider === 'custom_provider';
        const MAX_TOOL_CHARS = isLocalModel ? 4000 : 15000;
        if (typeof msg.content === 'string' && msg.content.length > MAX_TOOL_CHARS) {
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
