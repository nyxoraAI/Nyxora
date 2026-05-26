import * as dotenv from 'dotenv';
dotenv.config();

import { OpenAI } from 'openai';
import { loadConfig } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { getBalanceToolDefinition, getBalance } from '../web3/skills/getBalance';
import { transferToolDefinition, transferNative } from '../web3/skills/transfer';

export const logger = new Logger();

// Lazy initialize OpenAI client to prevent crash on startup if .env is not set yet
let openaiClient: OpenAI | null = null;
let currentProvider: string | null = null;

function getOpenAI(): OpenAI {
  const config = loadConfig();
  if (!openaiClient || currentProvider !== config.llm.provider) {
    currentProvider = config.llm.provider;
    
    if (config.llm.provider === 'ollama') {
      openaiClient = new OpenAI({
        baseURL: process.env.OLLAMA_BASE_URL ? `${process.env.OLLAMA_BASE_URL}/v1` : 'http://localhost:11434/v1',
        apiKey: 'ollama', // API key is not required for local Ollama
      });
    } else if (config.llm.provider === 'gemini') {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set in .env file.");
      }
      openaiClient = new OpenAI({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: process.env.GEMINI_API_KEY,
      });
    } else {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set in .env file.");
      }
      openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }
  return openaiClient;
}

function getSystemPrompt() {
  const config = loadConfig();
  return `You are an autonomous Web3 agent operating on EVM chains.
You are equipped with a native wallet. 
CRITICAL RULE: If the user asks to check "my balance", "saldo saya", or anything about their own wallet, DO NOT ask them for an address. You must immediately call the get_balance tool and LEAVE THE ADDRESS PARAMETER EMPTY. The system will automatically use the injected private key wallet.
Always use the tools to interact with the blockchain.
If the user doesn't specify a chain, default to: ${config.agent.default_chain}.`;
}

export async function processUserInput(input: string): Promise<string> {
  const config = loadConfig();
  // Add user input to memory
  logger.addEntry({ role: 'user', content: input });

  const history = logger.getHistory();
  
  // Format messages for OpenAI
  const messages: any[] = [
    { role: 'system', content: getSystemPrompt() },
    ...history.map(m => {
      const msg: any = { role: m.role, content: m.content || "" };
      if (m.name) msg.name = m.name;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      return msg;
    })
  ];

  try {
    if (config.llm.provider !== 'openai' && config.llm.provider !== 'ollama' && config.llm.provider !== 'gemini') {
      return `Provider ${config.llm.provider} is configured, but currently only OpenAI, Ollama, and Gemini adapters are implemented.`;
    }

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: config.llm.model,
      temperature: config.llm.temperature,
      messages: messages,
      tools: [getBalanceToolDefinition as any, transferToolDefinition as any],
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
        }
      }

      // Second call to get the final answer after tool execution
      const secondMessages = [
        { role: 'system', content: getSystemPrompt() },
        ...logger.getHistory().map(m => {
          const msg: any = { role: m.role, content: m.content || "" };
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
