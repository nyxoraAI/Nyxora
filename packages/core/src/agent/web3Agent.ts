import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';
import { isSkillActive } from '../utils/skillManager';
import { pluginManager } from '../plugin/registry';

import { getPath } from '../config/paths';
import pc from 'picocolors';

export const logger = new Logger();

import { getOpenAI, executeWithRetry } from '../utils/llmUtils';


function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'web3'): string {
    const config = loadConfig();
    const currentDateTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    let basePrompt = `You are Nyxora's Web3 Agent (DeFi Specialist).
The current real-world date and time is: ${currentDateTime}.
Default Chain: ${config.agent.default_chain}

Reason internally. Never reveal private reasoning. Provide only concise conclusions, assumptions, and actionable steps.

[WEB3 EXECUTION WORKFLOW]
CRITICAL RULE 1: NEVER expose internal JSON tool calls. Explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt.
CRITICAL RULE 3: DEFAULT CHAIN HANDLING. Default to: ${config.agent.default_chain} unless specified.
CRITICAL RULE 4: CONDITIONAL PARALLEL EXECUTION. Parallel tool execution is ONLY allowed if there are zero data dependencies.
CRITICAL RULE 5: TRANSACTION EXECUTION. For ALL state-changing transactions (swap, bridge, transfer), execute IMMEDIATELY. It will trigger a secure popup.
CRITICAL RULE 6: NETWORK SAFETY VALIDATION. NEVER GUESS chains or tokens. Ask for confirmation if ambiguous.
CRITICAL RULE 7: TOOL CONFIDENCE & HALUCINATION PREVENTION. NEVER fabricate blockchain data.
CRITICAL RULE 8: AMOUNT PRECISION. Use 6 decimal places for precision, or 2 if >$10,000.`;

  // Inject Episodic Memories
  try {
    const recentMemories = episodicDB.getMemories().slice(0, 10);
    if (recentMemories.length > 0) {
      basePrompt += `

--- EPISODIC MEMORIES (SMART SUGGESTIONS) ---
`;
      recentMemories.forEach(mem => {
        basePrompt += `- [${mem.category.toUpperCase()}] ${mem.fact} (Confidence: ${(mem.confidence * 100).toFixed(0)}%)
`;
      });
    }
  } catch (error) {}
  
  return basePrompt;
}

export async function processWeb3Intent(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input }, sessionId);

  const history = logger.getHistory(sessionId);
  
  // Format messages for OpenAI
  // Inject Plugin Tools dynamically
  const pluginTools = pluginManager.getAllToolDefinitions();
  
  let activeTools = [...pluginTools];
  activeTools = activeTools.filter(t => isSkillActive(t.function.name));

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');
  const sanitizedHistory = sanitizeHistoryForLLM(history, activeTools, config.llm.provider);

  let messages: any[] = [
    { role: 'system', content: getSystemPrompt('web3') },
    ...sanitizedHistory
  ];

  try {
    const context = 'web3';

    const response = await executeWithRetry(async (client) => {
      // Debug log to find out why Gemini 400 error happens
      console.log(`[LLM Debug] Sending ${messages.length} messages to LLM.`);
      return await client.chat({
          model: config.llm.model,
          temperature: config.llm.temperature,
          messages: messages,
          tools: activeTools
      });
    });

    const responseMessage = response.message;
    
    Tracker.addMessage();
    if (response.usage?.total_tokens) {
      Tracker.addTokens(response.usage.total_tokens, config.llm.provider);
    }
    Tracker.addEvent('llm.response', { provider: config.llm.provider, tool_calls: responseMessage.tool_calls?.length || 0 });

    logger.addEntry({
      role: 'assistant',
      content: responseMessage.content || "",
      tool_calls: responseMessage.tool_calls,
    }, sessionId);

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      let canFastReturnAll = true;
      let accumulatedResults: string[] = [];
      // Enabled fastReturnTools to eliminate 2nd LLM latency for transaction popups
      const fastReturnTools: string[] = [
        'transfer_token', 'transfer_native', 'swap_token', 'bridge_token', 
        'mint_nft', 'custom_tx', 'revoke_approval', 'supply_aave', 
        'deposit_yield_vault', 'provide_liquidity_v3'
      ];

      for (const _toolCall of responseMessage.tool_calls) {
        const toolCall = _toolCall as any;
        let result = "";
        let args: any = {};
        const toolName = toolCall.function.name;

        console.log(pc.yellow(`[⚡ Tool Execution] AI is calling ${toolName}...`));
        if (onProgress) onProgress(`_⚡ Running tool: ${toolName}..._`);

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseError: any) {
          console.error(pc.red(`[LLM Validation Error] Invalid JSON arguments for ${toolName}: ${parseError.message}`));
          result = `[System Error] Arguments for ${toolName} must be valid JSON. Please correct the format. Error: ${parseError.message}`;
          
          logger.addEntry({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result
          }, sessionId);
          
          continue;
        }

        if (!isSkillActive(toolName)) {
          console.warn(pc.red(`[Security] Blocked illegal execution of disabled skill: ${toolName}`));
          result = `[System Error] Access denied: Skill '${toolName}' is currently disabled by the user.`;
          logger.addEntry({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result
          }, sessionId);
          continue;
        }

        try {
          // 1. Execute via PluginManager
          const pluginResult = await pluginManager.executeTool(toolName, args, { sessionId });
          if (pluginResult !== null) {
            result = pluginResult;
          } else {
            result = `Error: Tool ${toolName} is not implemented.`;
          }

          if (result.includes('[Security Blocked]') || result.startsWith('Error:')) {
            console.log(pc.red(`[❌ Failed] Tool ${toolName} returned an error or was blocked.`));
          } else {
            console.log(pc.green(`[✅ Success] Tool ${toolName} executed successfully.`));
          }

        } catch (toolError: any) {
          result = `Error executing ${toolName}: ${toolError.message}`;
          console.error(pc.red(`[❌ Error Crash] Execution of ${toolName} failed completely: ${toolError.message}`));
        }

        logger.addEntry({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: result,
        }, sessionId);

        accumulatedResults.push(result);
        if (!fastReturnTools.includes(toolName)) {
          canFastReturnAll = false;
        }
      }

      // V2 Optimization (Expanded in v1.7.4): Zero-LLM Fast Return for data-heavy and read-only tools
      // If all tools already return perfectly formatted markdown, skip the second LLM call to save 5-10s latency!
      if (canFastReturnAll && accumulatedResults.length > 0) {
        const finalContent = accumulatedResults.join('\n\n---\n\n');
        logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
        return finalContent;
      }

      // Second call to get the final answer after tool execution
      const secondSanitized = sanitizeHistoryForLLM(logger.getHistory(sessionId), activeTools, config.llm.provider);
      const secondMessages = [
        { role: 'system', content: getSystemPrompt('web3') },
        ...secondSanitized
      ];

      const secondResponse = await executeWithRetry(async (client) => {
        return await client.chat({
          model: config.llm.model,
          messages: secondMessages,
        });
      });

      if (secondResponse.usage?.total_tokens) {
        Tracker.addTokens(secondResponse.usage.total_tokens, config.llm.provider);
      }
      Tracker.addEvent('llm.final_response', { provider: config.llm.provider });

      let finalContent = secondResponse.message.content || "";
      
      // Clean up orphaned <think> blocks that forgot to output </think>
      finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>\n?/gi, '');
      finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>\n?/gi, '');
      if (finalContent.includes('<think>')) {
        finalContent = finalContent.replace(/<think>[\s\S]*?\n\n/i, '');
        finalContent = finalContent.replace(/<think>[\s\S]*$/i, '');
      }
      finalContent = finalContent.trim();

      logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
      return finalContent;
    }

    let finalContent = responseMessage.content || "No response generated.";
    
    // Clean up orphaned <think> blocks that forgot to output </think>
    finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>\n?/gi, '');
    finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>\n?/gi, '');
    if (finalContent.includes('<think>')) {
      finalContent = finalContent.replace(/<think>[\s\S]*?\n\n/i, '');
      finalContent = finalContent.replace(/<think>[\s\S]*$/i, '');
    }
    finalContent = finalContent.trim();
    
    return finalContent;
  } catch (error: any) {
    console.error("LLM Error:", error);
    const status = error?.status || error?.response?.status;
    let errorMsg = '⚠️ All models are temporarily rate-limited. Please try again in a few minutes.';
    
    if (status === 400 || (error.message && error.message.toLowerCase().includes('invalid'))) {
      errorMsg = '⚠️ Terjadi kesalahan pemahaman instruksi. LLM kesulitan menentukan format alat (skill) yang cocok. Silakan coba deskripsikan perintah Anda dengan lebih spesifik.';
    }
    
    logger.addEntry({ role: 'assistant', content: errorMsg }, sessionId);
    return errorMsg;
  }
}
