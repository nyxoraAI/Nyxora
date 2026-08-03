import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig, loadApiKeys } from '../config/parser';
import { LLMProvider, AnthropicAdapter, GeminiAdapter, OpenAIAdapter } from '../agent/llmProvider';

let cachedLLMClient: LLMProvider | null = null;
let cachedProviderName = '';
let cachedApiKey = '';

export const PROVIDER_CONFIGS: Record<string, { baseURL?: string; requiresApiKey: boolean }> = {
  ollama: { baseURL: process.env.OLLAMA_BASE_URL ? `${process.env.OLLAMA_BASE_URL}/v1` : 'http://localhost:11434/v1', requiresApiKey: false },
  '9router': { baseURL: 'http://localhost:20128/v1', requiresApiKey: false },
  gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', requiresApiKey: true },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1', requiresApiKey: true },
  groq: { baseURL: 'https://api.groq.com/openai/v1', requiresApiKey: true },
  mistral: { baseURL: 'https://api.mistral.ai/v1', requiresApiKey: true },
  xai: { baseURL: 'https://api.x.ai/v1', requiresApiKey: true },
  deepseek: { baseURL: 'https://api.deepseek.com', requiresApiKey: true },
  nvidia: { baseURL: 'https://integrate.api.nvidia.com/v1', requiresApiKey: true },
  openai: { requiresApiKey: true },
  custom_provider: { requiresApiKey: true }
};

export function getEstimatedMaxContext(model: string): number {
  if (!model) return 32768;
  const m = model.toLowerCase();
  
  // Detect small local models based on parameter size
  if (m.includes('1.5b') || m.includes('3b')) return 8192;
  if (m.includes('7b') || m.includes('8b') || m.includes('9b') || m.includes('14b')) return 32768;
  
  if (m.includes('gemini-1.5-pro')) return 2000000;
  if (m.includes('gemini-1.5-flash') || m.includes('gemini-2')) return 1000000;
  if (m.includes('gemini')) return 1000000;
  if (m.includes('gpt-4o') || m.includes('gpt-4-turbo') || m.includes('gpt-4')) return 128000;
  if (m.includes('claude-3') || m.includes('claude-4')) return 200000;
  if (m.includes('grok')) return 128000;
  if (m.includes('deepseek')) return 128000;
  if (m.includes('nemotron') || m.includes('qwen') || m.includes('command')) return 128000;
  if (m.includes('mixtral') || m.includes('mistral')) return 32768;
  if (m.includes('llama-3.1') || m.includes('llama-3.2') || m.includes('llama-3.3') || m.includes('llama3.1')) return 128000;
  if (m.includes('llama-3') || m.includes('llama3')) return 8192;
  return 32768;
}

export async function getOpenAI(): Promise<OpenAI> {
  const config = loadConfig();
  const vaultKeys = await loadApiKeys();
  const providerName = config.llm.provider || 'openai';
  
  // Audio Transcription Fallback: Always try to use OpenAI/Groq if Anthropic/Gemini
  let actualProvider = (providerName === 'anthropic' || providerName === 'gemini') ? 'openai' : providerName;
  const providerConf = PROVIDER_CONFIGS[actualProvider] || PROVIDER_CONFIGS['openai'];

  let apiKey = 'local';
  if (providerConf.requiresApiKey) {
    const keyName = `${actualProvider}_key`;
    apiKey = vaultKeys[keyName] || config.credentials?.[keyName] || '';
    if (!apiKey && actualProvider === 'openai') {
        // Last resort fallback to groq for audio if openai key is missing
        actualProvider = 'groq';
        apiKey = vaultKeys['groq_key'] || config.credentials?.['groq_key'] || '';
    }
    if (!apiKey) {
      throw new Error(`[Security] No Audio Transcription API Key found (OpenAI/Groq). Please run 'nyxora set-key openai <key>'.`);
    }
  }

  return new OpenAI({
    baseURL: actualProvider === 'custom_provider' ? config.llm.base_url : (PROVIDER_CONFIGS[actualProvider] || PROVIDER_CONFIGS['openai']).baseURL,
    apiKey: apiKey,
    timeout: 600 * 1000,
    maxRetries: 0
  });
}

export async function getLLMClient(): Promise<LLMProvider> {
  const config = loadConfig();
  const vaultKeys = await loadApiKeys();
  const providerName = config.llm.provider || 'openai';
  const providerConf = PROVIDER_CONFIGS[providerName] || PROVIDER_CONFIGS['openai'];

  let apiKey = '';
  const keyName = `${providerName}_key`;
  apiKey = vaultKeys[keyName] || config.credentials?.[keyName] || '';

  if (!apiKey && providerConf.requiresApiKey) {
    throw new Error(`[Security] No API Key found for ${providerName} in OS Keyring. Please run 'nyxora set-key ${providerName} <key>' or 'nyxora setup'.`);
  }

  if (cachedLLMClient && cachedProviderName === providerName && cachedApiKey === apiKey) {
      return cachedLLMClient;
  }

  if (providerConf.requiresApiKey) {
    console.log(`[LLM] Using API Key securely unlocked from OS Keyring vault for ${providerName}.`);
  }

  cachedProviderName = providerName;
  cachedApiKey = apiKey;

  if (providerName === 'anthropic') {
    const client = new Anthropic({ apiKey });
    cachedLLMClient = new AnthropicAdapter(client);
    return cachedLLMClient;
  }

  if (providerName === 'gemini') {
    cachedLLMClient = new GeminiAdapter(apiKey);
    return cachedLLMClient;
  }

  // Default fallback (OpenAI, Groq, OpenRouter, xAI, Mistral, DeepSeek, Custom)
  const client = new OpenAI({
    baseURL: providerName === 'custom_provider' ? config.llm.base_url : providerConf.baseURL,
    apiKey: apiKey || 'local',
    timeout: 600 * 1000,
    maxRetries: 0
  });
  cachedLLMClient = new OpenAIAdapter(client);
  return cachedLLMClient;
}

export async function executeWithRetry(
  requestBuilder: (client: LLMProvider) => Promise<any>,
  maxRetries = 3
): Promise<any> {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const client = await getLLMClient();
      return await requestBuilder(client);
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const errMsg = (error?.message || '').toLowerCase();
      
      // If a 400 error contains "quota" or "rate limit", it's actually a Rate Limit. Exclude tool_call/schema errors!
      const isSchemaError = errMsg.includes('tool call') || errMsg.includes('tool_calls') || errMsg.includes('schema') || errMsg.includes('invalid_request_error');
      const isFake400RateLimit = status === 400 && !isSchemaError && (errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('reset after'));

      // 401 Unauthorized or true 400 Bad Request - don't retry, it's fatal
      if ((status === 401 || status === 400) && !isFake400RateLimit) {
        console.error(`[LLM] Fatal Error ${status}: ${error.message}. Aborting.`);
        throw error;
      }
      
      // Check if any error message specifies a reset delay (e.g., NVIDIA/Nemotron 502 with "reset after 11s")
      let waitMs = 0;
      if (errMsg.includes('reset after')) {
        const match = errMsg.match(/reset after (\d+)s/);
        if (match && match[1]) {
          waitMs = parseInt(match[1]) * 1000 + 1000;
        }
      }

      // 429 Rate Limit or Fake 400 Rate Limit - backoff and retry
      if (status === 429 || isFake400RateLimit) {
        console.warn(`[LLM] Rate Limit hit (${status}). Backing off...`);
        retries++;
        if (retries > maxRetries) throw error;
        
        const delayMs = waitMs > 0 ? waitMs : 2000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // 500, 502, 503, Timeout, Network error - Exponential Backoff
      retries++;
      if (retries > maxRetries) {
        console.error(`[LLM] Max retries reached.`);
        throw error;
      }
      
      const delayMs = waitMs > 0 ? waitMs : Math.pow(2, retries) * 1000; // waitMs or 2s, 4s, 8s
      console.warn(`[LLM] API Error (${status || error.message}). Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
