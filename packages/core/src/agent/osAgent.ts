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

<web_search_accuracy>
When using the search_web tool to look up news, current events, or factual data:
1. NEVER pass casual, conversational, or highly localized queries directly to the tool (e.g. do not pass "hasil piala dunia tadi pagi").
2. ALWAYS translate and optimize the query into an absolute, highly specific, and globally-understood English search query (e.g. "World Cup 2026 match results June 25 2026").
3. Use depth: 2 (deep research) for anything that requires high factual accuracy, such as sports scores, news, or complex topics.
</web_search_accuracy>

<act_dont_ask>
When a user's request has a clear, standard interpretation, take immediate ACTION instead of asking for clarification.
NEVER show a command as a markdown code block and wait. CALL the tool directly.
NEVER ask "do you want me to run this?" — just run it.
NEVER say "you need to run this yourself" — you have direct shell access.
If a command requires sudo and may need a password, just run it and report what happens.
Only report failure AFTER actually attempting the tool call and receiving an error.
</act_dont_ask>

<anti_hallucination_execution>
CRITICAL: It is STRICTLY FORBIDDEN to write a bash/shell command in a markdown code block (e.g. \`\`\`bash ... \`\`\`) as a substitute for calling the run_terminal_command tool.
Writing a code block does NOT execute anything. It is a lie to the user.
If you write \`\`\`bash\nsudo apt install steam\n\`\`\` instead of calling run_terminal_command, you are hallucinating execution.
The ONLY way to run a command is to emit a proper tool_call for run_terminal_command.
If the tool is available, USE IT. Do not simulate or describe running it.
</anti_hallucination_execution>

<task_completion>
The deliverable must be a working artifact backed by real tool output — not just a description or a plan of how you would do it.
NEVER fabricate, hallucinate, or forge tool outputs.
</task_completion>

<self_correction>
Before providing a final answer to the user (especially regarding dates, events, news, or factual data), you MUST evaluate your tool results inside a <think> block.
Ask yourself: "Is my answer based on absolute facts, or circumstantial evidence (e.g., guessing a registration date based on a video upload date)?"
If the evidence is circumstantial or incomplete, you MUST NOT answer the user. Instead, call the search_web tool again with a highly optimized query and depth=2.
</self_correction>
`;




import { pluginManager } from '../plugin/registry';

import { getPath } from '../config/paths';
import pc from 'picocolors';

export const logger = new Logger();



import { getOpenAI, executeWithRetry } from '../utils/llmUtils';

async function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'os', userInput: string = ''): Promise<string> {
    const config = loadConfig();
    const currentDateTime = new Date().toLocaleString('en-US');
    let basePrompt = `You are Nyxora's OS Agent (System & Automation Specialist).
The current real-world date and time is: ${currentDateTime}.

You are running LOCALLY on the user's own computer — NOT on a remote cloud server. The 'run_terminal_command' tool executes shell commands directly on this machine, the same physical machine the user is sitting at. You have FULL local shell access. When asked to install software, manage files, or perform any OS task, you MUST use run_terminal_command immediately. NEVER claim you cannot access the user's system.

Reason internally. Never reveal private reasoning. Provide only concise conclusions, assumptions, and actionable steps.

[OS EXECUTION WORKFLOW]
CRITICAL RULE 1: NEVER expose internal JSON tool calls. Explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt, UNLESS the Episodic Memories or Cognitive Skills specify a strict language preference.
CRITICAL RULE 3: FILE SYSTEM SAFETY. You are STRICTLY FORBIDDEN from modifying config.yaml, rpc_key.yaml, or policy.yaml using terminal commands like sed or echo.
CRITICAL RULE 4: CRON JOBS VS LIMIT ORDERS. Do NOT use schedule_task for price-based trading triggers. Use schedule_task for time-based recurring tasks.
CRITICAL RULE 5: TOOL CONFIDENCE. NEVER fabricate file contents or command outputs.

[SUDO & PACKAGE INSTALL STRATEGY]
This tool runs in a NON-INTERACTIVE shell (no TTY). Therefore:
- ALWAYS prefix apt/apt-get commands with: DEBIAN_FRONTEND=noninteractive
- ALWAYS use the -y flag for package installations to auto-confirm.
- If a command fails with "sudo: a password is required" or similar, DO NOT promise to retry without actually retrying. Instead:
  1. First retry with: echo 'USER_PASSWORD' | sudo -S <command> — but since you don't know the password, skip this.
  2. Instead, try running the command WITHOUT sudo if possible (e.g. for user-space tools).
  3. If sudo is truly required and unavailable, clearly tell the user EXACTLY what command to run manually in their terminal, with a copy-paste ready command. Do not just say it failed without providing a solution.
- NEVER promise to retry ("let me try again", "I'll run it again", etc.) without immediately making another tool_call in the same response.

${EXECUTION_DISCIPLINE}
`;


  // Inject Active Cognitive Skills
  const activeSOP = cognitiveManager.loadActiveCognitiveSkills(userInput);
  if (activeSOP) {
    basePrompt += `\n\n[ACTIVE COGNITIVE SKILLS]\n${activeSOP}\n`;
  }

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

  let activeTools = [...pluginManager.getAllToolDefinitions()];
  activeTools = activeTools.filter(t => isSkillActive(t.function.name));

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

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        // --- CRITIC PASS (Self-Improvement) ---
        const isLongResponse = (cleanedContent?.length ?? 0) > 100;
        if (isLongResponse && !criticHasFired) {
          criticHasFired = true;
          try {
            const criticRes = await fetch('http://127.0.0.1:8000/cognitive/critic', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_input: input, draft_answer: cleanedContent, current_utc_datetime: new Date().toISOString() })
            });
            if (criticRes.ok) {
              const evaluation = await criticRes.json();
              if (evaluation.needs_revision) {
                console.log(pc.cyan(`[🧠 Critic] Revision needed. Confidence: ${evaluation.factual_confidence?.toFixed(2)}. Completeness: ${evaluation.completeness?.toFixed(2)}. Re-generating...`));
                logger.addEntry({
                  role: 'system' as any,
                  content: `[SELF-CRITIQUE — MANDATORY REVISION] Your previous answer was REJECTED. Issues:\n${evaluation.revision_instructions}\n\nCRITICAL REVISION RULES:\n1. Look at the tool results (search_web, etc.) ALREADY in this conversation history above.\n2. Base your revised answer EXCLUSIVELY on those tool results — NEVER use training data memory for facts, dates, or events.\n3. If tool results contain the answer, state it directly and confidently. Do NOT say an event hasn't happened if the tool results show it has.\n4. Do NOT call any tools again — the results are already in your history. USE THEM NOW.`
                }, sessionId);
                continue; // Loop kembali ke Generator untuk revisi
              } else {
                console.log(pc.green(`[🧠 Critic] Passed. Confidence: ${evaluation.factual_confidence?.toFixed(2)}, Completeness: ${evaluation.completeness?.toFixed(2)}.`));
              }
            }
          } catch {
            // Python ML Engine tidak aktif — skip Critic, lanjut seperti biasa
          }
        }
        // --- END CRITIC PASS ---
        return cleanedContent || 'No response generated.';
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

  const pluginTools = pluginManager.getAllToolDefinitions();
  let activeTools = [...pluginTools].filter(t => isSkillActive(t.function.name));

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');

  try {
    let turnCount = 0;
    const MAX_TURNS = 10;
    let fullResponse = '';
    let criticHasFiredStream = false; // Critic Pass hanya aktif 1x per request

    while (turnCount < MAX_TURNS) {
      turnCount++;
      const currentHistory = logger.getHistory(sessionId);
      const sanitizedHistory = sanitizeHistoryForLLM(currentHistory, activeTools, config.llm.provider);
      const messages: any[] = [
        { role: 'system', content: await getSystemPrompt('os', input) },
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

        // --- CRITIC PASS (Self-Improvement) ---
        const isLongResponseStream = finalContent.length > 100;
        if (isLongResponseStream && !criticHasFiredStream) {
          criticHasFiredStream = true;
          try {
            const criticRes = await fetch('http://127.0.0.1:8000/cognitive/critic', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_input: input, draft_answer: finalContent, current_utc_datetime: new Date().toISOString() })
            });
            if (criticRes.ok) {
              const evaluation = await criticRes.json();
              if (evaluation.needs_revision) {
                console.log(pc.cyan(`[🧠 Critic] Revision needed. Confidence: ${evaluation.factual_confidence?.toFixed(2)}. Completeness: ${evaluation.completeness?.toFixed(2)}. Re-generating...`));
                logger.addEntry({
                  role: 'system' as any,
                  content: `[SELF-CRITIQUE — MANDATORY REVISION] Your previous answer was REJECTED. Issues:\n${evaluation.revision_instructions}\n\nCRITICAL REVISION RULES:\n1. Look at the tool results (search_web, etc.) ALREADY in this conversation history above.\n2. Base your revised answer EXCLUSIVELY on those tool results — NEVER use training data memory for facts, dates, or events.\n3. If tool results contain the answer, state it directly and confidently. Do NOT say an event hasn't happened if the tool results show it has.\n4. Do NOT call any tools again — the results are already in your history. USE THEM NOW.`
                }, sessionId);
                continue; // Loop kembali ke Generator untuk revisi
              } else {
                console.log(pc.green(`[🧠 Critic] Passed. Confidence: ${evaluation.factual_confidence?.toFixed(2)}, Completeness: ${evaluation.completeness?.toFixed(2)}.`));
              }
            }
          } catch {
            // Python ML Engine tidak aktif — skip Critic, lanjut seperti biasa
          }
        }
        // --- END CRITIC PASS ---

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
