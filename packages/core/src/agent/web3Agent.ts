import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';
import { isSkillActive } from '../utils/skillManager';
import { pluginManager } from '../plugin/registry';
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

import { getPath } from '../config/paths';
import pc from 'picocolors';

export const logger = new Logger();

import { getOpenAI, executeWithRetry } from '../utils/llmUtils';


function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'web3', userInput: string = ''): string {
    const config = loadConfig();
    const currentDateTime = new Date().toLocaleString('en-US');
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
CRITICAL RULE 8: AMOUNT PRECISION. Use 6 decimal places for precision, or 2 if >$10,000.
CRITICAL RULE 9: MARKET CONFIDENCE SCORE. Declare a 'Confidence Score (0-100%)' inside <think>. Warn if < 40%.

${EXECUTION_DISCIPLINE}
`;

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

  // Inject Active Cognitive Skills
  const activeSOP = cognitiveManager.loadActiveCognitiveSkills(userInput);
  if (activeSOP) {
    basePrompt += `\n\n[ACTIVE COGNITIVE SKILLS]\n${activeSOP}\n`;
  }
  
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
    { role: 'system', content: getSystemPrompt('web3', input) },
    ...sanitizedHistory
  ];

  try {
    const context = 'web3';
    let turnCount = 0;
    const MAX_TURNS = 10;

    while (turnCount < MAX_TURNS) {
      turnCount++;
      const currentHistory = logger.getHistory(sessionId);
      const sanitizedHistory = sanitizeHistoryForLLM(currentHistory, activeTools, config.llm.provider);
      const messages: any[] = [
        { role: 'system', content: getSystemPrompt('web3', input) },
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

      // --- LLM FALLBACK COMMAND PARSER (Minimax/Open-weight fix) ---
      if ((!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) && responseMessage.content) {
        const fallbacks: any[] = [];
        const regex = /^\/([a-zA-Z0-9_]+)\s+(.*)$/gm;
        let match;
        while ((match = regex.exec(responseMessage.content)) !== null) {
          const toolName = match[1];
          let argsStr = match[2];
          const argsObj: any = {};
          
          const kvRegex = /([a-zA-Z0-9_]+)=(".*?"|'.*?'|[^\s]+)/g;
          let kvMatch;
          while ((kvMatch = kvRegex.exec(argsStr)) !== null) {
            let key = kvMatch[1];
            let val = kvMatch[2].replace(/^["']|["']$/g, '');
            argsObj[key] = val;
          }
          
          // Map generic names if needed
          let mappedToolName = toolName;
          if (toolName === 'transfer' && argsObj.mode === 'bridge') mappedToolName = 'bridge_token';
          if (toolName === 'swap') mappedToolName = 'swap_token';
          
          fallbacks.push({
            id: 'call_fallback_' + Math.random().toString(36).substr(2, 9),
            type: 'function',
            function: {
              name: mappedToolName,
              arguments: JSON.stringify(argsObj)
            }
          });
        }
        
        if (fallbacks.length > 0) {
          responseMessage.tool_calls = fallbacks;
          responseMessage.content = responseMessage.content.replace(/^\/[a-zA-Z0-9_]+\s+.*$/gm, '').trim();
          console.log(pc.cyan(`[Fallback Parser] Intercepted ${fallbacks.length} raw text commands and converted to tool_calls.`));
          // Update logger entry with the intercepted tool calls
          logger.addEntry({
             role: 'assistant',
             content: responseMessage.content || "",
             tool_calls: responseMessage.tool_calls,
          }, sessionId);
        }
      }
      // -------------------------------------------------------------

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
