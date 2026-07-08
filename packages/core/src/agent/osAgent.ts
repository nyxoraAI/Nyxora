import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';
import { isSkillActive } from '../utils/skillManager';
import { cognitiveManager } from '../cognitive/cognitiveManager';
import { ReasoningScratchpad } from './reasoningScratchpad';
import { compressHistory, needsCompression } from '../utils/contextSummarizer';

import { promptBuilder } from './promptBuilder';

import { pluginManager, initializePlugins } from '../plugin/registry';

import { getPath } from '../config/paths';
import pc from 'picocolors';

// --- REGISTER LIFECYCLE HOOKS ---
pluginManager.registerHook({
  name: 'ReasoningGate',
  beforeToolCall: async (toolName, args, context) => {
    // FIX: Use actual Nyxora tool names (not legacy names)
    const toolsRequiringReasoning = ['run_terminal_command', 'write_local_file', 'edit_local_file', 'execute_script'];
    if (toolsRequiringReasoning.includes(toolName)) {
      const responseMessage = context.responseMessage || {};
      const hasThinkingTag = /<(think|thought|thinking|reasoning|analysis|reflection)>[\s\S]*?<\/\1>/i.test(responseMessage.content || '');
      const hasNativeReasoning = !!(responseMessage as any).reasoning_content;
      if (!hasThinkingTag && !hasNativeReasoning) {
        const msg = `[System Error] BLOCKED BY REASONING GATE: You MUST output a <think>...</think> block to plan your actions BEFORE calling the '${toolName}' tool. Please rethink and try again.`;
        console.log(pc.red(`[❌ Blocked] Tool ${toolName} blocked by Reasoning Gate.`));
        return { block: true, reason: msg };
      }
    }
  }
});

pluginManager.registerHook({
  name: 'Web3FastReturn',
  afterToolCall: async (toolName, args, result, context) => {
    // FIX: Only financial Web3 transactions need fast-return (to show approval popup ASAP).
    // send_telegram_file is NOT a financial transaction — removed from this list.
    const fastReturnTools = ['transfer_token', 'transfer_native', 'swap_token', 'bridge_token', 'mint_nft', 'custom_tx', 'revoke_approval', 'supply_aave', 'deposit_yield_vault', 'provide_liquidity_v3'];
    if (fastReturnTools.includes(toolName)) {
      return { terminate: true };
    }
  }
});
// --- END LIFECYCLE HOOKS ---

export const logger = new Logger();

// Helper to trigger background review async
const triggerBackgroundReview = async (sessionId?: string) => {
  try {
    const history = logger.getHistory(sessionId, 30);
    fetch('http://127.0.0.1:8000/cognitive/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        session_id: sessionId || 'default',
        trigger: 'turn_end'
      })
    }).catch(() => {});
  } catch (e) {
    // silently fail
  }
};


import { getOpenAI, executeWithRetry } from '../utils/llmUtils';

async function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'os', userInput: string = ''): Promise<string> {
    const config = loadConfig();
    // Safely deduce model family from config
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

export async function processOsIntent(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input }, sessionId);

  // --- MULTILINGUAL USER CORRECTION DETECTION ---
  const correctionSignals = [
    // ID
    'salah', 'ngawur', 'keliru', 'bukan', 'tidak benar', 'perbaiki', 'coba lagi',
    // EN
    'wrong', 'incorrect', 'mistake', 'not right', 'false', 'bad', 'fix', 'try again',
    // ES & FR
    'incorrecto', 'mal', 'equivocado', 'error', 'falso', 'faux', 'erreur', 'mauvais',
    // DE & RU
    'falsch', 'inkorrekt', 'fehler', 'ошибка', 'неправильно', 'неверно',
    // JP & ZH
    '違う', '間違い', 'やり直して', '错误', '不对'
  ];
  if (role === 'user' && correctionSignals.some(s => input.toLowerCase().includes(s))) {
    logger.addEntry({
      role: 'system' as any,
      content: `[USER CORRECTION DETECTED] The user indicated your previous answer was WRONG, STALE, or INACCURATE.
CRITICAL INSTRUCTIONS:
1. Do NOT just apologize and repeat the same data from your memory.
2. The data in your training memory or previous tool calls is likely stale/incorrect.
3. You MUST call a tool (like search_web or others) NOW to verify the facts with FRESH data.
4. Base your new answer strictly on the NEW tool results.`
    }, sessionId);
  }

  // FIX: Lazy-init guard — ensure plugins are always initialized before use.
  // This handles cases where processOsIntent is called before startServer() completes,
  // e.g., direct Telegram messages arriving before plugin initialization.
  if (pluginManager.getPlugins().length === 0) {
    console.warn('[OsAgent] ⚠️ Plugins not initialized! Running lazy initializePlugins()...');
    await initializePlugins();
  }

  let activeTools = [...pluginManager.getAllToolDefinitions()];
  activeTools = activeTools.filter(t => isSkillActive(t.function.name));

  if (activeTools.length === 0) {
    console.error('[OsAgent] ❌ CRITICAL: No active tools found after initialization! Retrying...');
    await initializePlugins();
    activeTools = [...pluginManager.getAllToolDefinitions()].filter(t => isSkillActive(t.function.name));
  }

  // P1: Init reasoning scratchpad for this request
  const scratchpad = new ReasoningScratchpad();

  // P3: Build system prompt ONCE per request — not per turn
  const cachedSystemPrompt = await getSystemPrompt('os', input);

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');

  try {
    let turnCount = 0;
    const MAX_TURNS = 10;
    let consecutiveToolErrors = 0;
    let criticHasFired = false; // Critic Pass hanya aktif 1x per request

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
            tools: activeTools,
            reasoning_effort: (!config.llm.reasoning_effort || config.llm.reasoning_effort === 'none') ? undefined : config.llm.reasoning_effort as any
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
      // -----------------------------------------------------

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        // --- CRITIC PASS REMOVED ---
        // The new PromptBuilder handles robust reasoning. Post-generation critic
        // causes aggressive loops and UI artifacts.
        triggerBackgroundReview(sessionId);
        return cleanedContent || '⚠️ I encountered an issue processing your request. This can happen with very complex multi-step tasks. Please try rephrasing or breaking the request into smaller steps.';
      }

      let canFastReturnAll = true;
      let accumulatedResults: string[] = [];
      // Enabled fastReturnTools to eliminate 2nd LLM latency for transaction popups
      // FIX: Removed send_telegram_file — not a financial transaction
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

        const getToolEmoji = (n: string) => {
          if (n.includes('file') || n.includes('read') || n.includes('write')) return '📄';
          if (n.includes('dir') || n.includes('folder')) return '📁';
          if (n.includes('cmd') || n.includes('shell') || n.includes('run')) return '🖥️';
          if (n.includes('search') || n.includes('find')) return '🔍';
          if (n.includes('git')) return '🐙';
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
        // FIX: Removed send_telegram_file from fast-return set
        if (!['transfer_token', 'transfer_native', 'swap_token', 'bridge_token', 'mint_nft', 'custom_tx', 'revoke_approval', 'supply_aave', 'deposit_yield_vault', 'provide_liquidity_v3'].includes(toolName)) {
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
          triggerBackgroundReview(sessionId);
          return errorSummary;
        }
      } else {
        consecutiveToolErrors = 0;
      }

      // V2 Optimization: Zero-LLM Fast Return for transaction tools
      if (canFastReturnAll && accumulatedResults.length > 0) {
        const finalContent = accumulatedResults.join('\n\n---\n\n');
        logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
        triggerBackgroundReview(sessionId);
        return finalContent;
      }
      
      // Loop continues, sending tool results in the next turn
    }
    
    const maxTurnMsg = "⚠️ Reached maximum interaction limit (10 turns). Please be more specific.";
    logger.addEntry({ role: 'assistant', content: maxTurnMsg }, sessionId);
    triggerBackgroundReview(sessionId);
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

  // --- MULTILINGUAL USER CORRECTION DETECTION ---
  const correctionSignals = [
    // ID
    'salah', 'ngawur', 'keliru', 'bukan', 'tidak benar', 'perbaiki', 'coba lagi',
    // EN
    'wrong', 'incorrect', 'mistake', 'not right', 'false', 'bad', 'fix', 'try again',
    // ES & FR
    'incorrecto', 'mal', 'equivocado', 'error', 'falso', 'faux', 'erreur', 'mauvais',
    // DE & RU
    'falsch', 'inkorrekt', 'fehler', 'ошибка', 'неправильно', 'неверно',
    // JP & ZH
    '違う', '間違い', 'やり直して', '错误', '不对'
  ];
  if (correctionSignals.some(s => input.toLowerCase().includes(s))) {
    logger.addEntry({
      role: 'system' as any,
      content: `[USER CORRECTION DETECTED] The user indicated your previous answer was WRONG, STALE, or INACCURATE.
CRITICAL INSTRUCTIONS:
1. Do NOT just apologize and repeat the same data from your memory.
2. The data in your training memory or previous tool calls is likely stale/incorrect.
3. You MUST call a tool (like search_web or others) NOW to verify the facts with FRESH data.
4. Base your new answer strictly on the NEW tool results.`
    }, sessionId);
  }

  // FIX: Lazy-init guard — same as processOsIntent
  if (pluginManager.getPlugins().length === 0) {
    console.warn('[OsAgentStream] ⚠️ Plugins not initialized! Running lazy initializePlugins()...');
    await initializePlugins();
  }

  const pluginTools = pluginManager.getAllToolDefinitions();
  let activeTools = [...pluginTools].filter(t => isSkillActive(t.function.name));

  if (activeTools.length === 0) {
    console.error('[OsAgentStream] ❌ CRITICAL: No active tools found after initialization! Retrying...');
    await initializePlugins();
    activeTools = [...pluginManager.getAllToolDefinitions()].filter(t => isSkillActive(t.function.name));
  }

  // FIX: Cache system prompt ONCE before loop (was being rebuilt every turn — wasteful)
  const cachedSystemPromptStream = await getSystemPrompt('os', input);

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');

  try {
    let turnCount = 0;
    let nudgeCount = 0;
    const MAX_TURNS = 15; // Increased from 10 — complex tasks need more turns
    let thinkingPrefillRetries = 0; // Prefill-continuation retries for think-only silent stops

    let fullResponse = '';
    let criticHasFiredStream = false; // Critic Pass hanya aktif 1x per request

    while (turnCount < MAX_TURNS) {
      turnCount++;
      const currentHistory = logger.getHistory(sessionId);
      
      const historyToUse = needsCompression(currentHistory)
        ? await compressHistory(currentHistory, sessionId)
        : currentHistory;
        
      const sanitizedHistory = sanitizeHistoryForLLM(historyToUse, activeTools, config.llm.provider);
      // FIX: Use cached system prompt — no longer rebuilt every turn
      const messages: any[] = [
        { role: 'system', content: cachedSystemPromptStream },
        ...sanitizedHistory
      ];

      let streamedContent = '';
      const response = await executeWithRetry(async (client) => {
        streamedContent = '';
        // RC#1 FIX: Only clear the Telegram buffer on the FIRST turn.
        // On subsequent turns (after tool calls), the buffer already shows useful
        // progress info. Resetting it causes visible content to disappear.
        if (turnCount === 1) onChunk('[CLEAR_STREAM]');
        return await client.stream(
          { model: config.llm.model, temperature: config.llm.temperature, messages, tools: activeTools, reasoning_effort: (!config.llm.reasoning_effort || config.llm.reasoning_effort === 'none') ? undefined : config.llm.reasoning_effort as any },
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
          // Detect think-only response: model reasoned but produced no tool calls or visible text.
          const hasNativeReasoning = !!(responseMessage as any).reasoning_content;
          const hasThinkTagInStream = /<(think|thought|thinking|reasoning)[\s\S]*?<\//i.test(streamedContent);
          const isThinkOnlyResponse = hasNativeReasoning || hasThinkTagInStream;

          // ── THINKING-PREFILL CONTINUATION ──
          // If model produced reasoning but no visible output, append the assistant message as-is
          // so the model sees its own reasoning on the next turn and continues naturally.
          // This avoids restarting the reasoning chain from scratch (which is what nudges do).
          if (isThinkOnlyResponse && thinkingPrefillRetries < 2) {
            thinkingPrefillRetries++;
            console.warn(`[OsAgentStream] ⚠️ Think-only silent stop — prefilling to continue (${thinkingPrefillRetries}/2)...`);
            // The assistant message is already in logger from the addEntry above.
            // The model will see its own reasoning and produce a tool call or text next turn.
            continue;
          }

          // ── NUDGE FALLBACK (after prefill exhaustion or truly empty) ──
          if (nudgeCount < 3) {
            nudgeCount++;
            const recentUserMsg = logger.getHistory(sessionId)
              .filter((m: any) => m.role === 'user').slice(-1)[0]?.content || 'the user request';

            let nudgeContent: string;
            if (isThinkOnlyResponse) {
              console.warn(`[OsAgentStream] ⚠️ Think-only prefill exhausted. System nudge (${nudgeCount}/3)...`);
              nudgeContent = `[SYSTEM NUDGE ${nudgeCount}/3 — SILENT STOP DETECTED]
You completed your internal reasoning but produced NO output (no tool call, no text).
This is a silent stop — it is not acceptable.

Task: "${recentUserMsg.substring(0, 200)}"

You MUST act RIGHT NOW. Do one of these:
  A) Call the first required tool immediately (e.g., write_local_file, run_terminal_command, send_telegram_file)
  B) Output a final text answer

Do NOT think again. Execute step 1 of the task NOW.`;
            } else {
              console.warn(`[OsAgentStream] ⚠️ Empty response. System nudge (${nudgeCount}/3)...`);
              nudgeContent = `[SYSTEM NUDGE ${nudgeCount}/3] Your last response was empty. You MUST take action now.

Task: "${recentUserMsg.substring(0, 200)}"

Available tools: write_local_file, run_terminal_command, send_telegram_file, search_web and others.
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
            console.error('[OsAgentStream] ❌ LLM failed to recover after prefill + 3 nudges. Aborting.');
            // Last-resort recovery: surface reasoning_content if available
            const reasoningContent = (responseMessage as any).reasoning_content || '';
            if (reasoningContent && reasoningContent.length > 50) {
              console.warn('[OsAgentStream] Using reasoning_content as fallback response.');
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
        triggerBackgroundReview(sessionId);
        break;
      }

      // Tool calls detected — pause stream visually and execute tools concurrently
      // BUG#1 FIX: Signal to Telegram to wipe turn-1 planning text from the buffer.
      // LLM often generates "thinking out loud" text before calling a tool (e.g. "Let me check...").
      // This text should NOT be shown to users. [TOOL_CALL_DETECTED] resets the buffer to a
      // clean progress indicator, hiding the planning text without losing the message handle.
      onChunk('[TOOL_CALL_DETECTED]');
      let shouldFastReturn = false;
      const accumulatedResults: string[] = [];


      const promises = responseMessage.tool_calls.map(async (_toolCall: any) => {
        const toolCall = _toolCall;
        const toolName = toolCall.function.name;
        let result = '';
        let args: any = {};
        const context = { sessionId, toolCallId: toolCall.id, responseMessage };

        console.log(pc.yellow(`[⚡ Tool Execution] AI is calling ${toolName}...`));
        if (onProgress) onProgress(`_⚡ Running tool: ${toolName}..._`);

        try {
          let argStr = toolCall.function.arguments;
          if (argStr && !argStr.trim().endsWith('}')) argStr += '}';
          args = JSON.parse(argStr);
        } catch (parseError: any) {
          result = `[System Error] Arguments for ${toolName} must be valid JSON. Error: ${parseError.message}`;
          logger.addEntry({ role: 'tool', tool_call_id: toolCall.id, content: result }, sessionId);
          return { toolName, result };
        }

        if (!isSkillActive(toolName)) {
          result = `[System Error] Access denied: Skill '${toolName}' is currently disabled.`;
          logger.addEntry({ role: 'tool', tool_call_id: toolCall.id, content: result }, sessionId);
          return { toolName, result };
        }

        // --- LIFECYCLE: BEFORE TOOL CALL ---
        const beforeRes = await pluginManager.triggerBeforeHooks(toolName, args, context);
        if (beforeRes && beforeRes.block) {
          result = beforeRes.reason || `[System Error] Blocked by hook for ${toolName}`;
          logger.addEntry({ role: 'tool', tool_call_id: toolCall.id, content: result }, sessionId);
          return { toolName, result };
        }

        try {
          const pluginResult = await pluginManager.executeTool(toolName, args, context, (partialResult: string) => {
            // Partial Streaming callback
            if (onProgress) onProgress(`_⏳ [${toolName}] ${partialResult}..._`);
          });
          
          result = pluginResult !== null ? pluginResult : `Error: Tool ${toolName} is not implemented.`;
          
          if (typeof result === 'string' && (result.includes('[Security Blocked]') || result.startsWith('Error:'))) {
            console.log(pc.red(`[❌ Failed] Tool ${toolName} returned an error or was blocked.`));
          } else {
            console.log(pc.green(`[✅ Success] Tool ${toolName} executed successfully.`));
          }
        } catch (toolError: any) {
          result = `Error executing ${toolName}: ${toolError.message}`;
          console.error(pc.red(`[❌ Error Crash] Execution of ${toolName} failed: ${toolError.message}`));
        }

        // --- LIFECYCLE: AFTER TOOL CALL ---
        const afterRes = await pluginManager.triggerAfterHooks(toolName, args, result, context);
        result = afterRes.content || result;
        if (afterRes.terminate) {
          shouldFastReturn = true;
        }

        logger.addEntry({ role: 'tool', tool_call_id: toolCall.id, name: toolName, content: result }, sessionId);
        return { toolName, result };
      });

      const results = await Promise.all(promises);
      results.forEach(r => accumulatedResults.push(r.result));

      if (shouldFastReturn && accumulatedResults.length > 0) {
        const finalContent = accumulatedResults.join('\n\n---\n\n');
        logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
        onChunk(finalContent);
        fullResponse = finalContent;
        triggerBackgroundReview(sessionId);
        break;
      }
    }

    if (!fullResponse) {
      const maxTurnMsg = '⚠️ Reached maximum interaction limit (10 turns). Please be more specific.';
      logger.addEntry({ role: 'assistant', content: maxTurnMsg }, sessionId);
      fullResponse = maxTurnMsg;
      triggerBackgroundReview(sessionId);
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
