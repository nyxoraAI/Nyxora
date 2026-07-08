import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';
import { isSkillActive } from '../utils/skillManager';
import { pluginManager, initializePlugins } from '../plugin/registry';
import { cognitiveManager } from '../cognitive/cognitiveManager';
import { ReasoningScratchpad } from './reasoningScratchpad';
import { compressHistory, needsCompression } from '../utils/contextSummarizer';

import { promptBuilder } from './promptBuilder';

export const logger = new Logger();

import { getOpenAI, executeWithRetry } from '../utils/llmUtils';
import { getPath } from '../config/paths';
import pc from 'picocolors';

async function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'web3', userInput: string = ''): Promise<string> {
    const config = loadConfig();
    const provider = (config?.llm?.provider || '').toLowerCase();
    let modelFamily: 'openai' | 'google' | 'anthropic' | 'grok' | 'unknown' = 'unknown';
    if (provider.includes('openai')) modelFamily = 'openai';
    else if (provider.includes('gemini') || provider.includes('google')) modelFamily = 'google';
    else if (provider.includes('anthropic') || provider.includes('claude')) modelFamily = 'anthropic';
    else if (provider.includes('grok') || provider.includes('xai')) modelFamily = 'grok';

    return await promptBuilder.buildSystemPrompt({
        agentType: context,
        userInput,
        config,
        modelFamily
    });
}

export async function processWeb3Intent(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input }, sessionId);

  // FIX: Lazy-init guard — ensure plugins are always loaded before tool execution.
  // Handles race conditions where Web3Agent is called before startServer() fully completes.
  if (pluginManager.getPlugins().length === 0) {
    console.warn('[Web3Agent] ⚠️ Plugins not initialized! Running lazy initializePlugins()...');
    await initializePlugins();
  }

  const pluginTools = pluginManager.getAllToolDefinitions();
  let activeTools = [...pluginTools];
  activeTools = activeTools.filter(t => isSkillActive(t.function.name));

  if (activeTools.length === 0) {
    console.error('[Web3Agent] ❌ CRITICAL: No active tools found after initialization! Retrying...');
    await initializePlugins();
    activeTools = [...pluginManager.getAllToolDefinitions()].filter(t => isSkillActive(t.function.name));
  }

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
        ? await compressHistory(currentHistory, sessionId)
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
        
        // 1. Slash commands (/swap amount="100")
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
        
        // 2. Markdown bash blocks (```bash ... ```)
        const mdRegex = /```(?:bash|sh|zsh)?\n([\s\S]*?)```/g;
        let mdMatch;
        while ((mdMatch = mdRegex.exec(responseMessage.content)) !== null) {
          const bashCmd = mdMatch[1].trim();
          if (bashCmd) {
            fallbacks.push({
              id: 'call_fallback_' + Math.random().toString(36).substr(2, 9),
              type: 'function',
              function: {
                name: 'run_terminal_command',
                arguments: JSON.stringify({ command: bashCmd })
              }
            });
          }
        }
        
        if (fallbacks.length > 0) {
          responseMessage.tool_calls = fallbacks;
          responseMessage.content = responseMessage.content.replace(/^\/[a-zA-Z0-9_]+\s+.*$/gm, '').replace(/```(?:bash|sh|zsh)?\n([\s\S]*?)```/g, '').trim();
          console.log(pc.cyan(`[Fallback Parser] Intercepted ${fallbacks.length} raw text commands and converted to tool_calls.`));
          // Update logger entry with the intercepted tool calls
          logger.addEntry({
             role: 'assistant',
             content: responseMessage.content || "",
             tool_calls: responseMessage.tool_calls,
          }, sessionId);
        }
      }
      // ---------------------------------------------------------------

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        return cleanedContent || '⚠️ I encountered an issue processing your request. This can happen with very complex multi-step tasks. Please try rephrasing or breaking the request into smaller steps.';
      }

      let canFastReturnAll = true;
      let accumulatedResults: string[] = [];
      // FIX: Removed send_telegram_file — only financial Web3 ops need fast-return
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

        const getToolEmoji = (n: string) => {
          if (n.includes('swap')) return '🔄';
          if (n.includes('bridge')) return '🌉';
          if (n.includes('transfer') || n.includes('send')) return '💸';
          if (n.includes('mint') || n.includes('nft')) return '🎨';
          if (n.includes('price') || n.includes('chart')) return '📈';
          if (n.includes('wallet') || n.includes('balance')) return '👛';
          return '⚙️';
        };
        const emoji = getToolEmoji(toolName);
        let argsPreview = "";
        try {
            const parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
            const firstKey = Object.keys(parsedArgs)[0];
            if (firstKey) argsPreview = `"${parsedArgs[firstKey]}"`;
        } catch(e) {}
        const previewMsg = argsPreview ? `${toolName}: ${argsPreview}` : toolName;

        console.log(pc.yellow(`[⚡ Tool Execution] AI is calling ${toolName}...`));
        if (onProgress) onProgress(`*${emoji} ${previewMsg}*`);

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

  // FIX: Lazy-init guard — same pattern as processWeb3Intent
  if (pluginManager.getPlugins().length === 0) {
    console.warn('[Web3AgentStream] ⚠️ Plugins not initialized! Running lazy initializePlugins()...');
    await initializePlugins();
  }

  const pluginTools = pluginManager.getAllToolDefinitions();
  let activeTools = [...pluginTools].filter(t => isSkillActive(t.function.name));

  if (activeTools.length === 0) {
    console.error('[Web3AgentStream] ❌ CRITICAL: No active tools found after initialization! Retrying...');
    await initializePlugins();
    activeTools = [...pluginManager.getAllToolDefinitions()].filter(t => isSkillActive(t.function.name));
  }

  // FIX: Cache system prompt ONCE before the loop (was rebuilt on every turn)
  const cachedWeb3SystemPrompt = await getSystemPrompt('web3', input);

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');

  try {
    let turnCount = 0;
    let nudgeCount = 0;
    const MAX_TURNS = 20;
    let thinkingPrefillRetries = 0; // Prefill-continuation retries for think-only silent stops
    let fullResponse = '';


    while (turnCount < MAX_TURNS) {
      turnCount++;
      const currentHistory = logger.getHistory(sessionId);
      
      const historyToUse = needsCompression(currentHistory)
        ? await compressHistory(currentHistory, sessionId)
        : currentHistory;
        
      const sanitizedHistory = sanitizeHistoryForLLM(historyToUse, activeTools, config.llm.provider);
      // FIX: Use cached system prompt — no longer rebuilt every turn
      const messages: any[] = [
        { role: 'system', content: cachedWeb3SystemPrompt },
        ...sanitizedHistory
      ];

      let streamedContent = '';
      const response = await executeWithRetry(async (client) => {
        streamedContent = '';
        // RC#1 FIX: Only clear the Telegram buffer on the FIRST turn.
        // Subsequent turns must NOT wipe the buffer that shows tool progress.
        if (turnCount === 1) onChunk('[CLEAR_STREAM]');
        return await client.stream(
          { model: config.llm.model, temperature: config.llm.temperature, messages, tools: activeTools, reasoning_effort: config.llm.reasoning_effort },
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
        reasoning_content: (responseMessage as any).reasoning_content,
        tool_calls: responseMessage.tool_calls,
      }, sessionId);

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        let finalContent = responseMessage.content || '';
        finalContent = finalContent.replace(/<(think|thought|thinking|reasoning|analysis|reflection)[\s\S]*?<\/\1>\n?/gi, '').trim();
        finalContent = finalContent.replace(/^\s*(?:\*\*)?(?:think|thought|thinking|reasoning|analysis|reflection)(?:\*\*)?\s*?\n[\s\S]*?\n\n/i, '').trim();
        
        if (finalContent === '') {
          const hasNativeReasoning = !!(responseMessage as any).reasoning_content;
          const hasThinkTagInStream = /<(think|thought|thinking|reasoning)[\s\S]*?<\//i.test(streamedContent);
          const isThinkOnlyResponse = hasNativeReasoning || hasThinkTagInStream;

          // ── THINKING-PREFILL CONTINUATION ──
          if (isThinkOnlyResponse && thinkingPrefillRetries < 2) {
            thinkingPrefillRetries++;
            console.warn(`[Web3AgentStream] ⚠️ Think-only silent stop — prefilling to continue (${thinkingPrefillRetries}/2)...`);
            continue;
          }

          // ── NUDGE FALLBACK (after prefill exhaustion or truly empty) ──
          if (nudgeCount < 3) {
            nudgeCount++;
            const recentUserMsg = logger.getHistory(sessionId)
              .filter((m: any) => m.role === 'user').slice(-1)[0]?.content || 'the user request';

            let nudgeContent: string;
            if (isThinkOnlyResponse) {
              console.warn(`[Web3AgentStream] ⚠️ Think-only prefill exhausted. System nudge (${nudgeCount}/3)...`);
              nudgeContent = `[SYSTEM NUDGE ${nudgeCount}/3 — SILENT STOP DETECTED]
You completed your internal reasoning but produced NO output (no tool call, no text).
This is a silent stop — it is not acceptable.

Task: "${recentUserMsg.substring(0, 200)}"

You MUST act RIGHT NOW. Do one of these:
  A) Call the first required tool immediately (e.g., get_price, analyze_market, get_balance)
  B) Output a final text answer

Do NOT think again. Execute step 1 of the task NOW.`;
            } else {
              console.warn(`[Web3AgentStream] ⚠️ Empty response. System nudge (${nudgeCount}/3)...`);
              nudgeContent = `[SYSTEM NUDGE ${nudgeCount}/3] Your last response was empty. You MUST take action now.

Task: "${recentUserMsg.substring(0, 200)}"

Available tools: get_price, analyze_market, get_balance, get_tx_history, swap_token and others.
You MUST either:
  A) Call one or more tools, OR
  B) Output a complete final text answer

Act now.`;
            }

            logger.addEntry({
              role: 'system' as any,
              content: nudgeContent
            }, sessionId);
            continue;
          } else {
            console.error('[Web3AgentStream] ❌ LLM failed to recover after prefill + 3 nudges. Aborting.');
            const reasoningContent = (responseMessage as any).reasoning_content || '';
            if (reasoningContent && reasoningContent.length > 50) {
              console.warn('[Web3AgentStream] Using reasoning_content as fallback response.');
              finalContent = reasoningContent.replace(/<(think|thought|thinking)[\s\S]*?<\/\1>/gi, '').trim()
                || '⚠️ I encountered an issue processing your request. This can happen with very complex multi-step tasks. Please try rephrasing or breaking the request into smaller steps.';
            } else {
              finalContent = '⚠️ I encountered an issue processing your request. This can happen with very complex multi-step tasks. Please try rephrasing or breaking the request into smaller steps.';
            }
          }
        }
        // Reset prefill counter on successful response
        thinkingPrefillRetries = 0;


        fullResponse = finalContent;
        break;
      }

      // Tool calls detected — pause stream visually and execute tools
      // BUG#1 FIX: Wipe turn-1 planning text. See osAgent.ts for full explanation.
      onChunk('[TOOL_CALL_DETECTED]');
      // FIX: Removed send_telegram_file — not a financial transaction
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
