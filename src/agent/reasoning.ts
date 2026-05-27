import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { getBalanceToolDefinition, getBalance } from '../web3/skills/getBalance';
import { transferToolDefinition, transferNative } from '../web3/skills/transfer';
import { getPriceToolDefinition, getPrice } from '../web3/skills/getPrice';
import { swapTokenToolDefinition, swapToken } from '../web3/skills/swapToken';
import { getPath } from '../config/paths';

export const logger = new Logger();

let currentKeyIndex = 0;

function getOpenAI(): OpenAI {
  const config = loadConfig();
  
  if (config.llm.provider === 'ollama') {
    return new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL ? `${process.env.OLLAMA_BASE_URL}/v1` : 'http://localhost:11434/v1',
      apiKey: 'ollama', // API key is not required for local Ollama
    });
  }

  // Get API key from config (UI) or fallback to .env
  let apiKey = '';
  
  let configuredKeys = config.llm.api_keys;
  if (typeof configuredKeys === 'string') {
    configuredKeys = [configuredKeys];
  }
  
  if (Array.isArray(configuredKeys) && configuredKeys.length > 0) {
    // Filter out empty keys
    const keys = configuredKeys.filter(k => typeof k === 'string' && k.trim() !== '');
    if (keys.length > 0) {
      currentKeyIndex = currentKeyIndex % keys.length;
      apiKey = keys[currentKeyIndex];
      console.log(`[LLM] Using rotated API Key (${currentKeyIndex + 1}/${keys.length}): ${apiKey.substring(0, 4)}...`);
      currentKeyIndex++; // Increment for next request
    }
  }

  // Fallbacks if no valid keys found in config.llm.api_keys
  if (!apiKey) {
    if (config.llm.provider === 'gemini') {
      apiKey = config.llm.credentials?.gemini_key || '';
    } else if (config.llm.provider === 'openrouter') {
      apiKey = config.llm.credentials?.openrouter_key || '';
    } else {
      apiKey = config.llm.credentials?.openai_key || '';
    }
    if (!apiKey) {
      throw new Error(`No API Key found for ${config.llm.provider} in config.yaml. Please run 'nyxora setup' to configure it.`);
    }
    console.log(`[LLM] Using default API Key from config.yaml`);
  }

  if (config.llm.provider === 'gemini') {
    return new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: apiKey,
    });
  } else if (config.llm.provider === 'openrouter') {
    return new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
    });
  } else {
    return new OpenAI({
      apiKey: apiKey,
    });
  }
}

function getSystemPrompt() {
  const config = loadConfig();
  let basePrompt = `You are an autonomous Web3 agent operating on EVM chains.
You are equipped with a native wallet. 
CRITICAL RULE: You must always reply in the exact same language that the user uses to talk to you. If the user speaks Indonesian, reply in Indonesian. If they speak English, reply in English.
CRITICAL RULE: If the user asks to check "my balance", "saldo saya", or anything about their own wallet, DO NOT ask them for an address. You must immediately call the get_balance tool and LEAVE THE ADDRESS PARAMETER EMPTY. The system will automatically use the injected private key wallet.
Always use the tools to interact with the blockchain.
If the user doesn't specify a chain, default to: ${config.agent.default_chain}.`;

  // Read IDENTITY.md for core AI persona
  try {
    const identityMdPath = getPath('IDENTITY.md');
    if (fs.existsSync(identityMdPath)) {
      const identityInstructions = fs.readFileSync(identityMdPath, 'utf8');
      basePrompt += `\n\n--- CORE IDENTITY & PERSONA ---\n${identityInstructions}`;
    }
  } catch (error) {
    console.error('Failed to read IDENTITY.md:', error);
  }

  // Read user.md for custom instructions
  try {
    const userMdPath = getPath('user.md');
    if (fs.existsSync(userMdPath)) {
      const customInstructions = fs.readFileSync(userMdPath, 'utf8');
      basePrompt += `\n\n--- CUSTOM USER INSTRUCTIONS ---\n${customInstructions}`;
    }
  } catch (error) {
    console.error('Failed to read user.md:', error);
  }

  return basePrompt;
}

export async function processUserInput(input: string, role: 'user' | 'system' = 'user'): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input });

  const history = logger.getHistory();
  
  // Format messages for OpenAI
  const messages: any[] = [
    { role: 'system', content: getSystemPrompt() },
    ...history
      .filter(m => !(m.role === 'tool' && !m.tool_call_id))
      .map(m => {
        let role = m.role;
        if (role === 'system') role = 'user';
        const msg: any = { role, content: m.content || "" };
        if (m.name) msg.name = m.name;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        return msg;
      })
  ];

  try {
    if (config.llm.provider !== 'openai' && config.llm.provider !== 'ollama' && config.llm.provider !== 'gemini' && config.llm.provider !== 'openrouter') {
      return `Provider ${config.llm.provider} is configured, but currently only OpenAI, OpenRouter, Ollama, and Gemini adapters are implemented.`;
    }

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: config.llm.model,
      temperature: config.llm.temperature,
      messages: messages,
      tools: [getBalanceToolDefinition as any, transferToolDefinition as any, getPriceToolDefinition as any, swapTokenToolDefinition as any],
      tool_choice: "auto",
    });

    const responseMessage = response.choices[0].message;
    
    // Log tracking
    Tracker.addMessage();
    if (response.usage?.total_tokens) {
      Tracker.addTokens(response.usage.total_tokens, config.llm.provider);
    }
    Tracker.addEvent('llm.response', { provider: config.llm.provider, tool_calls: responseMessage.tool_calls?.length || 0 });

    // Log assistant response
    logger.addEntry({
      role: 'assistant',
      content: responseMessage.content || "",
      tool_calls: responseMessage.tool_calls,
    });

    // Check if the model wants to call a tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      for (const _toolCall of responseMessage.tool_calls) {
        const toolCall = _toolCall as any;
        if (toolCall.function.name === 'get_balance') {
          const args = JSON.parse(toolCall.function.arguments);
          const balanceResult = await getBalance(args.chainName, args.address);
          
          logger.addEntry({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: balanceResult,
          });
        } else if (toolCall.function.name === 'transfer_native') {
          const args = JSON.parse(toolCall.function.arguments);
          const transferResult = await transferNative(args.chainName, args.toAddress, args.amountEth);
          
          logger.addEntry({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: transferResult,
          });
        } else if (toolCall.function.name === 'get_price') {
          const args = JSON.parse(toolCall.function.arguments);
          const priceResult = await getPrice(args.coinId);
          
          logger.addEntry({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: priceResult,
          });
        } else if (toolCall.function.name === 'swap_token') {
          const args = JSON.parse(toolCall.function.arguments);
          const swapResult = await swapToken(args.chainName, args.fromToken, args.toToken, args.amount);
          
          logger.addEntry({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: swapResult,
          });
        }
      }

      // Second call to get the final answer after tool execution
      const secondMessages = [
        { role: 'system', content: getSystemPrompt() },
        ...logger.getHistory()
          .filter(m => !(m.role === 'tool' && !m.tool_call_id))
          .map(m => {
            let role = m.role;
            if (role === 'system') role = 'user';
            const msg: any = { role, content: m.content || "" };
            if (m.name) msg.name = m.name;
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
            if (m.tool_calls) msg.tool_calls = m.tool_calls;
            return msg;
          })
      ];

      const openai = getOpenAI();
      const secondResponse = await openai.chat.completions.create({
        model: config.llm.model,
        messages: secondMessages,
      });

      if (secondResponse.usage?.total_tokens) {
        Tracker.addTokens(secondResponse.usage.total_tokens, config.llm.provider);
      }
      Tracker.addEvent('llm.final_response', { provider: config.llm.provider });

      const finalContent = secondResponse.choices[0].message.content || "";
      logger.addEntry({ role: 'assistant', content: finalContent });
      return finalContent;
    }

    return responseMessage.content || "No response generated.";
  } catch (error: any) {
    console.error("LLM Error:", error);
    return `Error connecting to AI Provider: ${error.message}`;
  }
}
