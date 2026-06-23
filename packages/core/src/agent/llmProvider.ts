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
}

export interface NormalizedChatResponse {
  message: {
    content: string | null;
    tool_calls?: {
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }[];
  };
}

export interface LLMProvider {
  chat(request: NormalizedChatRequest): Promise<NormalizedChatResponse>;
}

export class OpenAIAdapter implements LLMProvider {
  constructor(private client: OpenAI) {}

  async chat(request: NormalizedChatRequest): Promise<NormalizedChatResponse> {
    const response = await this.client.chat.completions.create(request as any);
    return {
      message: {
        content: response.choices[0].message.content,
        tool_calls: response.choices[0].message.tool_calls as any
      }
    };
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
            } catch (e) {}
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
    let toolCalls: any[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        contentStr = (contentStr || '') + block.text;
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

    return {
      message: {
        content: contentStr,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      }
    };
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
        contents.push({ role: 'user', parts: [{ text: m.content }] });
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
            } catch(e) {}
          });
        }
        contents.push({ role: 'model', parts: parts });
      } else if (m.role === 'tool') {
        contents.push({
          role: 'user',
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

    return {
      message: {
        content: contentStr,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      }
    };
  }
}
