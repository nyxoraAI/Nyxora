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
import { ReasoningScratchpad } from './reasoningScratchpad';
import { compressHistory, needsCompression } from '../utils/contextSummarizer';

const EXECUTION_DISCIPLINE = `


<tool_persistence>
Use tools whenever they can increase the accuracy, completeness, or factual correctness of your response.
Do NOT stop early if another tool call would materially improve the result.
Continue using tools until the task is completely finished and verified.
</tool_persistence>

<mandatory_tool_use>
NEVER answer the following using only your internal memory — ALWAYS use the relevant tool:
- Cryptocurrency prices, market data, and portfolio values (e.g., use get_price_and_fiat_value)
- Fiat exchange rates or currency conversions (fetch live rates, never guess)
- Arithmetic, math, calculations
- System State: OS version, RAM, processes
- File contents, file sizes
- Real-world current events
</mandatory_tool_use>

<fiat_conversion_rule>
CRITICAL: If the user asks for the total fiat value of a certain amount of crypto (e.g., "3821 jrny to idr", "2 eth in usd", "cek saldo gue dirupiahin"), you MUST pass that amount into the 'get_price_and_fiat_value' tool's 'amount' parameter.
You MUST also set the 'currency' parameter in 'get_price_and_fiat_value' ONLY IF the user explicitly requests a specific currency. If no specific currency is requested, LEAVE THE 'currency' PARAMETER BLANK so the system can use the user's default.
NEVER fetch the price and then manually multiply it by the amount in your head. The LLM is prohibited from performing fiat multiplication. ALWAYS use the 'amount' parameter in 'get_price_and_fiat_value' to guarantee mathematical precision.
NEVER use the 'analyze_market' tool if the user is only asking to check their balance in fiat/rupiah. 'analyze_market' does not do fiat conversion.
</fiat_conversion_rule>

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


async function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'web3', userInput: string = ''): Promise<string> {
    const config = loadConfig();
    let basePrompt = `You are Nyxora's Web3 Agent (DeFi Specialist).
Current Time: ${new Date().toISOString()}
Default Chain: ${config.agent.default_chain}

Reason internally. Never reveal private reasoning. Provide only concise conclusions, assumptions, and actionable steps.

[WEB3 EXECUTION WORKFLOW]
CRITICAL RULE 1: NEVER expose internal JSON tool calls. Explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt, UNLESS the Episodic Memories or Cognitive Skills specify a strict language preference.
CRITICAL RULE 3: DEFAULT CHAIN HANDLING. Default to: ${config.agent.default_chain} unless specified.
CRITICAL RULE 4: CONDITIONAL PARALLEL EXECUTION. Parallel tool execution is ONLY allowed if there are zero data dependencies.
CRITICAL RULE 5: TRANSACTION EXECUTION. For ALL state-changing transactions (swap, bridge, transfer), execute IMMEDIATELY. It will trigger a secure popup.
CRITICAL RULE 6: NETWORK SAFETY VALIDATION. NEVER GUESS chains or tokens. Ask for confirmation if ambiguous.
CRITICAL RULE 7: TOOL CONFIDENCE & HALUCINATION PREVENTION. NEVER fabricate blockchain data.
CRITICAL RULE 8: AMOUNT PRECISION. Use 6 decimal places for precision, or 2 if >$10,000.
CRITICAL RULE 9: MARKET CONFIDENCE SCORE. Declare a 'Confidence Score (0-100%)' inside <think>. Warn if < 40%.

${EXECUTION_DISCIPLINE}
`;

  // Inject Episodic Memories via Python RAG
  try {
    const ragRes = await fetch('http://127.0.0.1:8000/memory/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userInput, top_k: 5 })
    });
    if (ragRes.ok) {
      const ragData = await ragRes.json();
      if (ragData.memories && ragData.memories.length > 0) {
        basePrompt += `\n\n--- EPISODIC MEMORIES (SMART SUGGESTIONS) ---\n`;
        ragData.memories.forEach((mem: string) => {
          basePrompt += `- ${mem}\n`;
        });
      }
    }
  } catch (e) {
    // Fallback or ignore if Python ML engine is down
  }

  // Inject Active Cognitive Skills
  const activeSOP = cognitiveManager.loadActiveCognitiveSkills(userInput);
  if (activeSOP) {
    basePrompt += `\n\n[ACTIVE COGNITIVE SKILLS]\n${activeSOP}\n`;
  }
  // Inject User Information & Personas from user.md
  try {
    const userMdPath = getPath('user.md');
    if (fs.existsSync(userMdPath)) {
      const userInstructions = fs.readFileSync(userMdPath, 'utf8');
      basePrompt += `\n\n--- USER INFORMATION & PREFERENCES ---\n${userInstructions}\n`;
    }
  } catch (e) {
    // Ignore error
  }
  
  // HIGHEST PRIORITY: Inject observed user communication style (NyxDaemon)
  try {
    const strongPersonas = episodicDB.getStrongPersonas(0.5);
    if (strongPersonas.length > 0) {
      basePrompt += `\n\n--- ⚡ OVERRIDE: USER COMMUNICATION STYLE (HIGHEST PRIORITY — OVERRIDES ALL RULES ABOVE) ---\n`;
      basePrompt += `CRITICAL: These are CONFIRMED user preferences observed across multiple conversations. You MUST apply them IMMEDIATELY and CONSISTENTLY, overriding any default tone or style instructions above.\n\n`;
      strongPersonas.forEach(p => {
        const label = p.category ? `[${p.category.toUpperCase()}]` : '[PREFERENCE]';
        basePrompt += `${label} ${p.trait}\n`;
      });
    }
  } catch (e) {
    // Ignore
  }

  return basePrompt;
}

export async function processWeb3Intent(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input }, sessionId);

  const pluginTools = pluginManager.getAllToolDefinitions();
  let activeTools = [...pluginTools];
  activeTools = activeTools.filter(t => isSkillActive(t.function.name));

  // P1: Init reasoning scratchpad for this request
  const scratchpad = new ReasoningScratchpad();

  // P3: Build system prompt ONCE per request — not per turn
  const cachedSystemPrompt = await getSystemPrompt('web3', input);

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');

  try {
    let turnCount = 0;
    const MAX_TURNS = 20;
    let consecutiveToolErrors = 0;

    while (turnCount < MAX_TURNS) {
      turnCount++;
      const currentHistory = logger.getHistory(sessionId);

      // P6: Compress history if conversation is too long
      const historyToUse = needsCompression(currentHistory)
        ? await compressHistory(currentHistory)
        : currentHistory;

      const sanitizedHistory = sanitizeHistoryForLLM(historyToUse, activeTools, config.llm.provider);

      // P1: Inject scratchpad into system prompt for turns > 1
      const sysPrompt = turnCount === 1
        ? cachedSystemPrompt
        : cachedSystemPrompt + scratchpad.getInjection();

      const messages: any[] = [
        { role: 'system', content: sysPrompt },
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

      // P1: Capture <think> blocks for scratchpad, get clean content
      const cleanedContent = scratchpad.capture(responseMessage.content || '', turnCount);

      logger.addEntry({
        role: 'assistant',
        content: cleanedContent || '',
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
      // -----------------------------------------------------

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        return cleanedContent || 'No response generated.';
      }

      let canFastReturnAll = true;
      let accumulatedResults: string[] = [];
      // Enabled fastReturnTools to eliminate 2nd LLM latency for transaction popups
      const fastReturnTools: string[] = [
        'transfer_token', 'transfer_native', 'swap_token', 'bridge_token', 
        'mint_nft', 'custom_tx', 'revoke_approval', 'supply_aave', 
        'deposit_yield_vault', 'provide_liquidity_v3', 'confirm_pending_tx'
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

      // P4: Self-reflection — if ALL tools failed, inject reflection before next turn
      const allFailed = accumulatedResults.length > 0 && accumulatedResults.every(
        r => r.startsWith('Error') || r.includes('[System Error]') || r.includes('[Security Blocked]')
      );
      if (allFailed) {
        consecutiveToolErrors++;
        const reflection = `[SELF-REFLECTION] All ${accumulatedResults.length} tool call(s) failed (attempt ${consecutiveToolErrors}). ` +
          `Errors: ${accumulatedResults.join(' | ')}. ` +
          `Analyze WHY each failed. Options: (1) retry with corrected params, (2) use alternative tool, (3) inform user clearly. ` +
          `Do NOT repeat the exact same failed call.`;
        logger.addEntry({ role: 'system' as any, content: reflection }, sessionId);
        console.log(pc.magenta(`[Self-Reflection] Turn ${turnCount}: all tools failed, injecting reflection.`));

        if (consecutiveToolErrors >= 2) {
          const errorSummary = `⚠️ Unable to complete this request after multiple attempts.\n${accumulatedResults.join('\n')}`;
          logger.addEntry({ role: 'assistant', content: errorSummary }, sessionId);
          return errorSummary;
        }
      } else {
        consecutiveToolErrors = 0;
      }

      // V2 Optimization: Zero-LLM Fast Return for transaction tools
      if (canFastReturnAll && accumulatedResults.length > 0) {
        const finalContent = accumulatedResults.join('\n\n---\n\n');
        logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
        return finalContent;
      }
      
      // Loop continues, sending tool results in the next turn
    }
    
    const maxTurnMsg = "⚠️ Reached maximum interaction limit (20 turns). Please be more specific.";
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

export async function processWeb3IntentStream(
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
    const MAX_TURNS = 20;
    let fullResponse = '';

    while (turnCount < MAX_TURNS) {
      turnCount++;
      const currentHistory = logger.getHistory(sessionId);
      const sanitizedHistory = sanitizeHistoryForLLM(currentHistory, activeTools, config.llm.provider);
      const messages: any[] = [
        { role: 'system', content: await getSystemPrompt('web3', input) },
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
      const fastReturnTools = ['transfer_token', 'transfer_native', 'swap_token', 'bridge_token', 'mint_nft', 'custom_tx', 'revoke_approval', 'supply_aave', 'deposit_yield_vault', 'provide_liquidity_v3', 'confirm_pending_tx'];
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
      const maxTurnMsg = '⚠️ Reached maximum interaction limit (20 turns). Please be more specific.';
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
