import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';
import { isSkillActive } from '../utils/skillManager';
import { cognitiveManager } from '../cognitive/cognitiveManager';

const EXECUTION_DISCIPLINE = `
<tool_persistence>
Use tools whenever they can increase the accuracy, completeness, or factual correctness of your response.
Do NOT stop early if another tool call would materially improve the result.
Continue using tools until the task is completely finished and verified.
</tool_persistence>

<mandatory_tool_use>
NEVER answer the following using only your internal memory — ALWAYS use the relevant tool:
- Arithmetic, math, calculations
- System State: OS version, RAM, processes
- File contents, file sizes
- Real-world current events
</mandatory_tool_use>

<act_dont_ask>
When a user's request has a clear, standard interpretation, take immediate ACTION instead of asking for clarification.
</act_dont_ask>

<task_completion>
The deliverable must be a working artifact backed by real tool output — not just a description or a plan of how you would do it.
NEVER fabricate, hallucinate, or forge tool outputs.
</task_completion>
`;


import { pluginManager } from '../plugin/registry';

import { getPath } from '../config/paths';
import pc from 'picocolors';

export const logger = new Logger();



import { getOpenAI, executeWithRetry } from '../utils/llmUtils';

function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'os', userInput: string = ''): string {
    const config = loadConfig();
    const currentDateTime = new Date().toLocaleString('en-US');
    let basePrompt = `You are Nyxora's OS Agent (System & Automation Specialist).
The current real-world date and time is: ${currentDateTime}.

Reason internally. Never reveal private reasoning. Provide only concise conclusions, assumptions, and actionable steps.

[OS EXECUTION WORKFLOW]
CRITICAL RULE 1: NEVER expose internal JSON tool calls. Explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt.
CRITICAL RULE 3: FILE SYSTEM SAFETY. You are STRICTLY FORBIDDEN from modifying config.yaml, rpc_key.yaml, or policy.yaml using terminal commands like sed or echo.
CRITICAL RULE 4: CRON JOBS VS LIMIT ORDERS. Do NOT use schedule_task for price-based trading triggers. Use schedule_task for time-based recurring tasks.
CRITICAL RULE 5: TOOL CONFIDENCE. NEVER fabricate file contents or command outputs.

${EXECUTION_DISCIPLINE}
`;

  // Inject Active Cognitive Skills
  const activeSOP = cognitiveManager.loadActiveCognitiveSkills(userInput);
  if (activeSOP) {
    basePrompt += `\n\n[ACTIVE COGNITIVE SKILLS]\n${activeSOP}\n`;
  }

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
  } catch {}
  
  return basePrompt;
}

export async function processOsIntent(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input }, sessionId);

  const history = logger.getHistory(sessionId);
  
  // Format messages for OpenAI
  let activeTools = [...pluginManager.getAllToolDefinitions()];
  activeTools = activeTools.filter(t => isSkillActive(t.function.name));

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');
  const sanitizedHistory = sanitizeHistoryForLLM(history, activeTools, config.llm.provider);

  let messages: any[] = [
    { role: 'system', content: getSystemPrompt('os', input) },
    ...sanitizedHistory
  ];

  try {
    let turnCount = 0;
    const MAX_TURNS = 10;

    while (turnCount < MAX_TURNS) {
      turnCount++;
      const currentHistory = logger.getHistory(sessionId);
      const sanitizedHistory = sanitizeHistoryForLLM(currentHistory, activeTools, config.llm.provider);
      const messages: any[] = [
        { role: 'system', content: getSystemPrompt('os', input) },
        ...sanitizedHistory
      ];

      const response = await executeWithRetry(async (client) => {
        return await client.chat({
            model: config.llm.model,
            temperature: config.llm.temperature,
            messages: messages,
            tools: activeTools
        });
      });

      const responseMessage = response.message;
      
      if (turnCount === 1) {
        Tracker.addMessage();
      }
      
      if (response.usage?.total_tokens) {
        Tracker.addTokens(response.usage.total_tokens, config.llm.provider);
      }
      Tracker.addEvent('llm.response', { provider: config.llm.provider, tool_calls: responseMessage.tool_calls?.length || 0 });

      logger.addEntry({
        role: 'assistant',
        content: responseMessage.content || "",
        tool_calls: responseMessage.tool_calls,
      }, sessionId);

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        let finalContent = responseMessage.content || "No response generated.";
        finalContent = finalContent.replace(/<(think|thought|thinking|reasoning|analysis|reflection)>[\s\S]*?<\/\1>\n?/gi, '');
        finalContent = finalContent.trim();
        return finalContent;
      }

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
          let argStr = toolCall.function.arguments;
          // [Auto-Recovery] Fix common LLM JSON errors (e.g. missing closing brace)
          if (argStr && !argStr.trim().endsWith('}')) {
            argStr += '}';
          }
          args = JSON.parse(argStr);
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
      
      // Loop continues, sending tool results in the next turn
    }
    
    const maxTurnMsg = "⚠️ Reached maximum interaction limit (10 turns). Please be more specific.";
    logger.addEntry({ role: 'assistant', content: maxTurnMsg }, sessionId);
    return maxTurnMsg;
  } catch (error: any) {
    console.error("LLM Error:", error);
    const status = error?.status || error?.response?.status;
    let errorMsg = '⚠️ All models are temporarily rate-limited. Please try again in a few minutes.';
    
    if (status === 400 || (error.message && error.message.toLowerCase().includes('invalid'))) {
      errorMsg = '⚠️ Failed to parse instruction. The LLM had trouble determining the appropriate tool format. Please describe your command more specifically.';
    }
    
    logger.addEntry({ role: 'assistant', content: errorMsg }, sessionId);
    return errorMsg;
  }
}

export async function processOsIntentStream(
  input: string,
  onChunk: (text: string) => void,
  onProgress?: (msg: string) => void,
  sessionId?: string
): Promise<string> {
  const config = loadConfig();
  logger.addEntry({ role: 'user', content: input }, sessionId);

  const pluginTools = pluginManager.getAllToolDefinitions();
  let activeTools = [...pluginTools].filter(t => isSkillActive(t.function.name));

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');

  try {
    let turnCount = 0;
    const MAX_TURNS = 10;
    let fullResponse = '';

    while (turnCount < MAX_TURNS) {
      turnCount++;
      const currentHistory = logger.getHistory(sessionId);
      const sanitizedHistory = sanitizeHistoryForLLM(currentHistory, activeTools, config.llm.provider);
      const messages: any[] = [
        { role: 'system', content: getSystemPrompt('os', input) },
        ...sanitizedHistory
      ];

      let streamedContent = '';
      const response = await executeWithRetry(async (client) => {
        return await client.stream(
          { model: config.llm.model, temperature: config.llm.temperature, messages, tools: activeTools },
          (chunk: string) => {
            streamedContent += chunk;
            onChunk(chunk);
          }
        );
      });

      const responseMessage = response.message;

      if (turnCount === 1) Tracker.addMessage();
      if (response.usage?.total_tokens) Tracker.addTokens(response.usage.total_tokens, config.llm.provider);
      Tracker.addEvent('llm.response', { provider: config.llm.provider, tool_calls: responseMessage.tool_calls?.length || 0 });

      logger.addEntry({
        role: 'assistant',
        content: responseMessage.content || '',
        tool_calls: responseMessage.tool_calls,
      }, sessionId);

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        let finalContent = responseMessage.content || 'No response generated.';
        finalContent = finalContent.replace(/<(think|thought|thinking|reasoning|analysis|reflection)[\s\S]*?<\/\1>\n?/gi, '').trim();
        fullResponse = finalContent;
        break;
      }

      // Tool calls detected — pause stream visually and execute tools
      const fastReturnTools = ['transfer_token', 'transfer_native', 'swap_token', 'bridge_token', 'mint_nft', 'custom_tx', 'revoke_approval', 'supply_aave', 'deposit_yield_vault', 'provide_liquidity_v3'];
      let canFastReturnAll = true;
      const accumulatedResults: string[] = [];

      for (const _toolCall of responseMessage.tool_calls) {
        const toolCall = _toolCall as any;
        const toolName = toolCall.function.name;
        let result = '';
        let args: any = {};

        console.log(pc.yellow(`[⚡ Tool Execution] AI is calling ${toolName}...`));
        if (onProgress) onProgress(`_⚡ Running tool: ${toolName}..._`);

        try {
          let argStr = toolCall.function.arguments;
          if (argStr && !argStr.trim().endsWith('}')) argStr += '}';
          args = JSON.parse(argStr);
        } catch (parseError: any) {
          result = `[System Error] Arguments for ${toolName} must be valid JSON. Error: ${parseError.message}`;
          logger.addEntry({ role: 'tool', tool_call_id: toolCall.id, content: result }, sessionId);
          continue;
        }

        if (!isSkillActive(toolName)) {
          result = `[System Error] Access denied: Skill '${toolName}' is currently disabled.`;
          logger.addEntry({ role: 'tool', tool_call_id: toolCall.id, content: result }, sessionId);
          continue;
        }

        try {
          const pluginResult = await pluginManager.executeTool(toolName, args, { sessionId });
          result = pluginResult !== null ? pluginResult : `Error: Tool ${toolName} is not implemented.`;
          if (result.includes('[Security Blocked]') || result.startsWith('Error:')) {
            console.log(pc.red(`[❌ Failed] Tool ${toolName} returned an error or was blocked.`));
          } else {
            console.log(pc.green(`[✅ Success] Tool ${toolName} executed successfully.`));
          }
        } catch (toolError: any) {
          result = `Error executing ${toolName}: ${toolError.message}`;
          console.error(pc.red(`[❌ Error Crash] Execution of ${toolName} failed: ${toolError.message}`));
        }

        logger.addEntry({ role: 'tool', tool_call_id: toolCall.id, name: toolName, content: result }, sessionId);
        accumulatedResults.push(result);
        if (!fastReturnTools.includes(toolName)) canFastReturnAll = false;
      }

      if (canFastReturnAll && accumulatedResults.length > 0) {
        const finalContent = accumulatedResults.join('\n\n---\n\n');
        logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
        onChunk(finalContent);
        fullResponse = finalContent;
        break;
      }
    }

    if (!fullResponse) {
      const maxTurnMsg = '⚠️ Reached maximum interaction limit (10 turns). Please be more specific.';
      logger.addEntry({ role: 'assistant', content: maxTurnMsg }, sessionId);
      fullResponse = maxTurnMsg;
    }

    return fullResponse;
  } catch (error: any) {
    console.error('LLM Stream Error:', error);
    const status = error?.status || error?.response?.status;
    let errorMsg = '⚠️ All models are temporarily rate-limited. Please try again in a few minutes.';
    if (status === 400 || (error.message && error.message.toLowerCase().includes('invalid'))) {
      errorMsg = '⚠️ Failed to parse instruction. Please describe your command more specifically.';
    }
    logger.addEntry({ role: 'assistant', content: errorMsg }, sessionId);
    return errorMsg;
  }
}
