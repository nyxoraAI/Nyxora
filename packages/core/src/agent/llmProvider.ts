import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig, loadApiKeys } from '../config/parser';

export interface NormalizedChatRequest {
  model: string;
  messages: any[];
  tools?: any[];
  tool_choice?: 'auto' | 'none' | any;
  temperature?: number;
  max_tokens?: number;
  reasoning_effort?: 'low' | 'medium' | 'high' | 'none' | null;
}

export interface NormalizedChatResponse {
  message: {
    content: string | null;
    reasoning_content?: string | null;
    tool_calls?: {
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }[];
  };
  usage?: {
    total_tokens: number;
  };
}

export interface LLMProvider {
  chat(request: NormalizedChatRequest): Promise<NormalizedChatResponse>;
  stream(request: NormalizedChatRequest, onChunk: (text: string) => void): Promise<NormalizedChatResponse>;
}

export function extractExecuteTool(content: string, existingToolCalls: any[]): { content: string, toolCalls: any[] } {
  let newContent = content;
  const toolCalls = [...existingToolCalls];
  
  if (newContent) {
    const executeToolMatches = newContent.match(/<execute_tool>([\s\S]*?)<\/execute_tool>/gi);
    if (executeToolMatches) {
      for (const match of executeToolMatches) {
        const innerMatch = match.match(/<execute_tool>([\s\S]*?)<\/execute_tool>/i);
        if (innerMatch && innerMatch[1]) {
          try {
            const parsed = JSON.parse(innerMatch[1].trim());
            if (parsed.tool_name) {
              toolCalls.push({
                id: `call_${Math.random().toString(36).substring(7)}`,
                type: 'function',
                function: {
                  name: parsed.tool_name,
                  arguments: JSON.stringify(parsed.tool_params || {})
                }
              });
            }
          } catch (e) {
            console.warn('[LLM] Failed to parse <execute_tool> JSON', e);
          }
        }
      }
      newContent = newContent.replace(/<execute_tool>[\s\S]*?<\/execute_tool>\n?/gi, '').trim();
    }
  }
  
  return { content: newContent, toolCalls };
}

export class OpenAIAdapter implements LLMProvider {
  constructor(private client: OpenAI) {}

  async chat(request: NormalizedChatRequest): Promise<NormalizedChatResponse> {
    const payload = { ...request } as any;
    if (payload.reasoning_effort && !(payload.model.startsWith('o1') || payload.model.startsWith('o3'))) {
        delete payload.reasoning_effort;
    }
    // Suppress token-level repetition loops. 0.6 is aggressive enough to stop
    // phrase-echoing but not so high that it degrades coherent prose.
    if (payload.frequency_penalty === undefined) payload.frequency_penalty = 0.6;
    if (payload.presence_penalty === undefined) payload.presence_penalty = 0.3;
    const response = await this.client.chat.completions.create(payload);
    let content = response.choices[0].message.content || '';
    let reasoning = (response.choices[0].message as any).reasoning_content || null;
    
    // Extract <thinking> tags from content if present
    const thinkingMatch = content.match(/<(think|thought|thinking|reasoning|analysis|reflection)>([\s\S]*?)<\/\1>/i);
    if (thinkingMatch) {
      reasoning = (reasoning || '') + thinkingMatch[2].trim();
      content = content.replace(/<(think|thought|thinking|reasoning|analysis|reflection)>[\s\S]*?<\/\1>\n?/i, '').trim();
    }

    let finalToolCalls = response.choices[0].message.tool_calls as any || [];
    const extracted = extractExecuteTool(content, finalToolCalls);
    content = extracted.content;
    finalToolCalls = extracted.toolCalls;

    return {
      message: {
        content: content || null,
        reasoning_content: reasoning || null,
        tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined
      },
      usage: response.usage ? { total_tokens: response.usage.total_tokens } : undefined
    };
  }

  async stream(request: NormalizedChatRequest, onChunk: (text: string) => void): Promise<NormalizedChatResponse> {
    try {
      const payload = { ...request, stream: true } as any;
      if (payload.reasoning_effort && !(payload.model.startsWith('o1') || payload.model.startsWith('o3'))) {
          delete payload.reasoning_effort;
      }
      // Suppress token-level repetition loops (same as chat())
      if (payload.frequency_penalty === undefined) payload.frequency_penalty = 0.6;
      if (payload.presence_penalty === undefined) payload.presence_penalty = 0.3;
      const streamRes = await this.client.chat.completions.create(payload) as any as AsyncIterable<any>;
      let fullContent = '';
      let reasoningContent = '';
      const toolCallsMap: Record<number, any> = {};

      for await (const chunk of streamRes) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }
        if (delta?.reasoning_content || (delta as any)?.reasoning) {
          reasoningContent += (delta.reasoning_content || (delta as any).reasoning);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallsMap[tc.index]) {
              toolCallsMap[tc.index] = { id: tc.id || '', type: 'function', function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' } };
            } else {
              if (tc.id) toolCallsMap[tc.index].id = tc.id;
              if (tc.function?.name) toolCallsMap[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCallsMap[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
      }

      const toolCalls = Object.values(toolCallsMap);
      
      // Post-process to extract <thinking> tags that were streamed as part of content
      const thinkingMatch = fullContent.match(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>([\s\S]*?)<\/\1>/i);
      if (thinkingMatch) {
        reasoningContent = (reasoningContent || '') + thinkingMatch[2].trim();
        fullContent = fullContent.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>[\s\S]*?<\/\1>\n?/i, '').trim();
      }

      let finalToolCalls = toolCalls;
      const extracted = extractExecuteTool(fullContent, finalToolCalls);
      fullContent = extracted.content;
      finalToolCalls = extracted.toolCalls;

      return {
        message: {
          content: fullContent || null,
          reasoning_content: reasoningContent || null,
          tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined
        }
      };
    } catch (e) {
      // Fallback to non-streaming if streaming fails
      const chatRes = await this.chat(request);
      if (chatRes.message.content) {
        onChunk('[CLEAR_STREAM]');
        onChunk(chatRes.message.content);
      }
      return chatRes;
    }
  }
}

export class AnthropicAdapter implements LLMProvider {
  constructor(private client: Anthropic) {}

  async chat(request: NormalizedChatRequest): Promise<NormalizedChatResponse> {
    let systemPrompt = '';
    const anthropicMessages: any[] = [];
    for (const m of request.messages) {
      if (m.role === 'system') {
        systemPrompt = m.content;
        continue;
      }
      
      if (m.role === 'user') {
        anthropicMessages.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        const blocks: any[] = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        if (m.tool_calls) {
          m.tool_calls.forEach((tc: any) => {
            try {
              blocks.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.function.name,
                input: JSON.parse(tc.function.arguments)
              });
            } catch {}
          });
        }
        anthropicMessages.push({ role: 'assistant', content: blocks.length > 0 ? blocks : m.content });
      } else if (m.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.tool_call_id,
              content: m.content
            }
          ]
        });
      }
    }

    // Merge consecutive roles (Anthropic strictly requires alternating user/assistant)
    const mergedAnthropic: any[] = [];
    for (const m of anthropicMessages) {
      const last = mergedAnthropic[mergedAnthropic.length - 1];
      if (last && last.role === m.role) {
        if (Array.isArray(last.content) && Array.isArray(m.content)) {
          last.content.push(...m.content);
        } else if (typeof last.content === 'string' && typeof m.content === 'string') {
          last.content += '\n\n' + m.content;
        } else if (Array.isArray(last.content) && typeof m.content === 'string') {
          last.content.push({ type: 'text', text: m.content });
        } else if (typeof last.content === 'string' && Array.isArray(m.content)) {
          last.content = [{ type: 'text', text: last.content }, ...m.content];
        }
      } else {
        mergedAnthropic.push(m);
      }
    }

    let anthropicTools: any = undefined;
    if (request.tools) {
      anthropicTools = request.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }));
    }

    const response = await this.client.messages.create({
      model: request.model,
      system: systemPrompt,
      messages: mergedAnthropic,
      tools: anthropicTools,
      temperature: request.temperature,
      max_tokens: request.max_tokens || 4096
    });

    let contentStr = null;
    let reasoningStr = null;
    let toolCalls: any[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        contentStr = (contentStr || '') + block.text;
      } else if (block.type === 'thinking' as any) {
        reasoningStr = (reasoningStr || '') + (block as any).thinking;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        });
      }
    }

    if (contentStr) {
      const thinkingMatch = contentStr.match(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>([\s\S]*?)<\/\1>/i);
      if (thinkingMatch) {
        reasoningStr = (reasoningStr || '') + thinkingMatch[2].trim();
        contentStr = contentStr.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>[\s\S]*?<\/\1>\n?/i, '').trim();
      }
    }

    let finalToolCalls = toolCalls;
    if (contentStr) {
      const extracted = extractExecuteTool(contentStr, finalToolCalls);
      contentStr = extracted.content;
      finalToolCalls = extracted.toolCalls;
    }

    return {
      message: {
        content: contentStr || null,
        reasoning_content: reasoningStr || null,
        tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined
      },
      usage: response.usage ? { total_tokens: response.usage.input_tokens + response.usage.output_tokens } : undefined
    };
  }

  async stream(request: NormalizedChatRequest, onChunk: (text: string) => void): Promise<NormalizedChatResponse> {
    try {
      // Build the same message format as chat()
      let systemPrompt = '';
      const anthropicMessages: any[] = [];
      for (const m of request.messages) {
        if (m.role === 'system') { systemPrompt = m.content; continue; }
        if (m.role === 'user') {
          anthropicMessages.push({ role: 'user', content: m.content });
        } else if (m.role === 'assistant') {
          const blocks: any[] = [];
          if (m.content) blocks.push({ type: 'text', text: m.content });
          if (m.tool_calls) m.tool_calls.forEach((tc: any) => {
            try { blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) }); } catch {}
          });
          anthropicMessages.push({ role: 'assistant', content: blocks.length > 0 ? blocks : m.content });
        } else if (m.role === 'tool') {
          anthropicMessages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }] });
        }
      }
      const mergedAnthropic: any[] = [];
      for (const m of anthropicMessages) {
        const last = mergedAnthropic[mergedAnthropic.length - 1];
        if (last && last.role === m.role) {
          if (Array.isArray(last.content) && Array.isArray(m.content)) last.content.push(...m.content);
          else if (typeof last.content === 'string' && typeof m.content === 'string') last.content += '\n\n' + m.content;
          else if (Array.isArray(last.content) && typeof m.content === 'string') last.content.push({ type: 'text', text: m.content });
          else last.content = [{ type: 'text', text: typeof last.content === 'string' ? last.content : '' }, ...m.content];
        } else { mergedAnthropic.push(m); }
      }
      let anthropicTools: any = undefined;
      if (request.tools && request.tools.length > 0) {
        anthropicTools = request.tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
      }
      const stream = this.client.messages.stream({
        model: request.model,
        system: systemPrompt,
        messages: mergedAnthropic,
        tools: anthropicTools,
        temperature: request.temperature,
        max_tokens: request.max_tokens || 4096
      });

      let fullContent = '';
      let reasoningContent = '';
      const toolCalls: any[] = [];

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          onChunk(event.delta.text);
        }
        if (event.type === 'content_block_delta' && (event.delta as any).type === 'thinking_delta') {
          reasoningContent += (event.delta as any).thinking;
        }
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          toolCalls.push({ id: event.content_block.id, type: 'function', function: { name: event.content_block.name, arguments: '' } });
        }
        if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
          const last = toolCalls[toolCalls.length - 1];
          if (last) last.function.arguments += event.delta.partial_json;
        }
      }

      if (fullContent) {
        const thinkingMatch = fullContent.match(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>([\s\S]*?)<\/\1>/i);
        if (thinkingMatch) {
          reasoningContent = (reasoningContent || '') + thinkingMatch[2].trim();
          fullContent = fullContent.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>[\s\S]*?<\/\1>\n?/i, '').trim();
        }
      }

      let finalToolCalls = toolCalls;
      if (fullContent) {
        const extracted = extractExecuteTool(fullContent, finalToolCalls);
        fullContent = extracted.content;
        finalToolCalls = extracted.toolCalls;
      }

      return { message: { content: fullContent || null, reasoning_content: reasoningContent || null, tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined } };
    } catch {
      const chatRes = await this.chat(request);
      if (chatRes.message.content) {
        onChunk('[CLEAR_STREAM]');
        onChunk(chatRes.message.content);
      }
      return chatRes;
    }
  }
}

export class GeminiAdapter implements LLMProvider {
  constructor(private apiKey: string) {}

  async chat(request: NormalizedChatRequest): Promise<NormalizedChatResponse> {
    let systemInstruction = '';
    const contents: any[] = [];
    
    for (const m of request.messages) {
      if (m.role === 'system') {
        systemInstruction = m.content;
        continue;
      }
      
      if (m.role === 'user') {
        if (Array.isArray(m.content)) {
          const parts: any[] = [];
          for (const block of m.content) {
            if (block.type === 'text') parts.push({ text: block.text });
            else if (block.type === 'image_url') {
              const bData = block.image_url.url.replace(/^data:image\/[a-z]+;base64,/, '');
              parts.push({ inlineData: { mimeType: 'image/png', data: bData } });
            }
          }
          contents.push({ role: 'user', parts });
        } else {
          contents.push({ role: 'user', parts: [{ text: m.content }] });
        }
      } else if (m.role === 'assistant') {
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.tool_calls) {
          m.tool_calls.forEach((tc: any) => {
            try {
              parts.push({
                functionCall: {
                  name: tc.function.name,
                  args: JSON.parse(tc.function.arguments)
                }
              });
            } catch {}
          });
        }
        if (parts.length > 0) {
          contents.push({ role: 'model', parts: parts });
        }
      } else if (m.role === 'tool') {
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: m.name || 'unknown_tool',
              response: { result: m.content }
            }
          }]
        });
      }
    }

    // Merge adjacent messages of the same role
    const mergedContents: any[] = [];
    for (const m of contents) {
      const last = mergedContents[mergedContents.length - 1];
      if (last && last.role === m.role) {
        last.parts.push(...m.parts);
      } else {
        mergedContents.push(m);
      }
    }

    let tools: any = undefined;
    if (request.tools && request.tools.length > 0) {
      tools = [{
        functionDeclarations: request.tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }];
    }

    const payload: any = {
      contents: mergedContents,
      generationConfig: {
        temperature: request.temperature || 0.7,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
      ]
    };

    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (tools) {
      payload.tools = tools;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();

    let contentStr = null;
    let toolCalls: any[] = [];

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`[LLM] Gemini API returned finishReason: ${candidate.finishReason}`);
      }

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            contentStr = (contentStr || '') + part.text;
          } else if (part.functionCall) {
            toolCalls.push({
              id: `call_${Math.random().toString(36).substring(7)}`,
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args || {})
              }
            });
          }
        }
      }
    }

    let totalTokens = 0;
    if (data.usageMetadata && data.usageMetadata.totalTokenCount) {
      totalTokens = data.usageMetadata.totalTokenCount;
    }

    let reasoningContent = null;
    if (contentStr) {
      const thinkingMatch = contentStr.match(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>([\s\S]*?)<\/\1>/i);
      if (thinkingMatch) {
        reasoningContent = thinkingMatch[2].trim();
        contentStr = contentStr.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>[\s\S]*?<\/\1>\n?/i, '').trim();
      }
    }

    let finalToolCalls = toolCalls;
    if (contentStr) {
      const extracted = extractExecuteTool(contentStr, finalToolCalls);
      contentStr = extracted.content;
      finalToolCalls = extracted.toolCalls;
    }

    return {
      message: {
        content: contentStr || null,
        reasoning_content: reasoningContent || null,
        tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined
      },
      usage: totalTokens > 0 ? { total_tokens: totalTokens } : undefined
    };
  }

  async stream(request: NormalizedChatRequest, onChunk: (text: string) => void): Promise<NormalizedChatResponse> {
    let systemInstruction = '';
    const contents: any[] = [];
    
    for (const m of request.messages) {
      if (m.role === 'system') {
        systemInstruction = m.content;
        continue;
      }
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content }] });
      } else if (m.role === 'assistant') {
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.tool_calls) {
          m.tool_calls.forEach((tc: any) => {
            try { parts.push({ functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) } }); } catch {}
          });
        }
        if (parts.length > 0) contents.push({ role: 'model', parts });
      } else if (m.role === 'tool') {
        contents.push({ role: 'function', parts: [{ functionResponse: { name: m.name || 'unknown_tool', response: { result: m.content } } }] });
      }
    }

    const mergedContents: any[] = [];
    for (const m of contents) {
      const last = mergedContents[mergedContents.length - 1];
      if (last && last.role === m.role) last.parts.push(...m.parts);
      else mergedContents.push(m);
    }

    let tools: any = undefined;
    if (request.tools && request.tools.length > 0) {
      tools = [{ functionDeclarations: request.tools.map(t => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters })) }];
    }

    const payload: any = {
      contents: mergedContents,
      generationConfig: { temperature: request.temperature || 0.7 },
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
      ]
    };

    if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    if (tools) payload.tools = tools;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) return this.chat(request);

      let contentStr = '';
      const toolCalls: any[] = [];
      let totalTokens = 0;
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;
            try {
              const data = JSON.parse(raw);
              if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                if (candidate.content && candidate.content.parts) {
                  for (const part of candidate.content.parts) {
                    if (part.text) {
                      contentStr += part.text;
                      onChunk(part.text);
                    } else if (part.functionCall) {
                      toolCalls.push({
                        id: `call_${Math.random().toString(36).substring(7)}`,
                        type: 'function',
                        function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args || {}) }
                      });
                    }
                  }
                }
              }
              if (data.usageMetadata?.totalTokenCount) totalTokens = data.usageMetadata.totalTokenCount;
            } catch {}
          }
        }
      }

      let reasoningContent = null;
      if (contentStr) {
        const thinkingMatch = contentStr.match(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>([\s\S]*?)<\/\1>/i);
        if (thinkingMatch) {
          reasoningContent = thinkingMatch[2].trim();
          contentStr = contentStr.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>[\s\S]*?<\/\1>\n?/i, '').trim();
        }
      }

      let finalToolCalls = toolCalls;
      if (contentStr) {
        const extracted = extractExecuteTool(contentStr, finalToolCalls);
        contentStr = extracted.content;
        finalToolCalls = extracted.toolCalls;
      }

      return {
        message: { content: contentStr || null, reasoning_content: reasoningContent || null, tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined },
        usage: totalTokens > 0 ? { total_tokens: totalTokens } : undefined
      };
    } catch {
      const chatRes = await this.chat(request);
      if (chatRes.message.content) {
        onChunk('[CLEAR_STREAM]');
        onChunk(chatRes.message.content);
      }
      return chatRes;
    }
  }
}
