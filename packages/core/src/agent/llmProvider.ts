import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
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
  constructor(private client: GoogleGenAI) {}

  async chat(request: NormalizedChatRequest): Promise<NormalizedChatResponse> {
    let systemInstruction = '';
    const rawGemini: any[] = [];
    for (const m of request.messages) {
      if (m.role === 'system') {
        systemInstruction = m.content;
        continue;
      }
      
      if (m.role === 'user') {
        rawGemini.push({ role: 'user', parts: [{ text: m.content }] });
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
        rawGemini.push({ role: 'model', parts: parts });
      } else if (m.role === 'tool') {
        rawGemini.push({
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

    const geminiMessages: any[] = [];
    for (const m of rawGemini) {
      const last = geminiMessages[geminiMessages.length - 1];
      if (last && last.role === m.role) {
        last.parts.push(...m.parts);
      } else {
        geminiMessages.push(m);
      }
    }

    let tools: any = undefined;
    if (request.tools) {
      tools = [{
        functionDeclarations: request.tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }];
    }

    const response = await this.client.models.generateContent({
      model: request.model,
      contents: geminiMessages as any,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        temperature: request.temperature,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    });

    let contentStr = null;
    let toolCalls: any[] = [];

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      
      // Log finish reason for debugging safety blocks
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`[LLM] Gemini API returned finishReason: ${candidate.finishReason}`);
      }

      if (candidate.content && candidate.content.parts) {
        const parts = candidate.content.parts;
        for (const part of parts) {
          if (part.text) {
            contentStr = (contentStr || '') + part.text;
          } else if (part.functionCall) {
          toolCalls.push({
            id: `call_${Math.random().toString(36).substring(7)}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args)
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
