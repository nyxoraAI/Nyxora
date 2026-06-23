import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig, loadApiKeys } from '../config/parser';
import { LLMProvider, AnthropicAdapter, GeminiAdapter, OpenAIAdapter } from '../agent/llmProvider';

let cachedLLMClient: LLMProvider | null = null;
let cachedProviderName = '';
let cachedApiKey = '';

export const PROVIDER_CONFIGS: Record<string, { baseURL?: string; requiresApiKey: boolean }> = {
  ollama: { baseURL: process.env.OLLAMA_BASE_URL ? `${process.env.OLLAMA_BASE_URL}/v1` : 'http://localhost:11434/v1', requiresApiKey: false },
  gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', requiresApiKey: true },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1', requiresApiKey: true },
  groq: { baseURL: 'https://api.groq.com/openai/v1', requiresApiKey: true },
  mistral: { baseURL: 'https://api.mistral.ai/v1', requiresApiKey: true },
  xai: { baseURL: 'https://api.x.ai/v1', requiresApiKey: true },
  deepseek: { baseURL: 'https://api.deepseek.com', requiresApiKey: true },
  openai: { requiresApiKey: true }
};

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
    baseURL: (PROVIDER_CONFIGS[actualProvider] || PROVIDER_CONFIGS['openai']).baseURL,
    apiKey: apiKey,
    timeout: 120 * 1000,
    maxRetries: 0
  });
}

export async function getLLMClient(): Promise<LLMProvider> {
  const config = loadConfig();
  const vaultKeys = await loadApiKeys();
  const providerName = config.llm.provider || 'openai';

  let apiKey = '';
  const keyName = `${providerName}_key`;
  apiKey = vaultKeys[keyName] || config.credentials?.[keyName] || '';

  if (!apiKey && providerName !== 'ollama') {
    throw new Error(`[Security] No API Key found for ${providerName} in OS Keyring. Please run 'nyxora set-key ${providerName} <key>' or 'nyxora setup'.`);
  }

  if (cachedLLMClient && cachedProviderName === providerName && cachedApiKey === apiKey) {
      return cachedLLMClient;
  }

  if (providerName !== 'ollama') {
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

  // Default fallback (OpenAI, Groq, OpenRouter, xAI, Mistral, DeepSeek)
  const providerConf = PROVIDER_CONFIGS[providerName] || PROVIDER_CONFIGS['openai'];
  const client = new OpenAI({
    baseURL: providerConf.baseURL,
    apiKey: apiKey || 'local',
    timeout: 120 * 1000,
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
      
      // 401 Unauthorized or 400 Bad Request - don't retry, it's fatal
      if (status === 401 || status === 400) {
        console.error(`[LLM] Fatal Error ${status}: ${error.message}. Aborting.`);
        throw error;
      }
      
      // 429 Rate Limit - rotate provider/key immediately and retry
      if (status === 429) {
        console.warn(`[LLM] Rate Limit (429) hit. Rotating key...`);
        // getOpenAI() automatically rotates to next key if available
        retries++;
        if (retries > maxRetries) throw error;
        continue; // Try next key immediately
      }
      
      // 500, 502, 503, Timeout, Network error - Exponential Backoff
      retries++;
      if (retries > maxRetries) {
        console.error(`[LLM] Max retries reached.`);
        throw error;
      }
      
      const delayMs = Math.pow(2, retries) * 1000; // 2s, 4s, 8s
      console.warn(`[LLM] API Error (${status || error.message}). Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
