import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';
import { isSkillActive } from '../utils/skillManager';


import { updateProfileToolDefinition, updateProfile } from './updateProfile';
import { updateIdentityToolDefinition, updateIdentity } from './updateIdentity';
import { updateSecurityPolicyToolDefinition, updateSecurityPolicy } from '../system/skills/updateSecurityPolicy';
import { analyzeDocumentToolDefinition, analyzeDocument } from '../system/skills/analyzeDocument';
import { readLocalFileToolDefinition, readLocalFile } from '../system/skills/readFile';
import { writeLocalFileToolDefinition, writeLocalFile } from '../system/skills/writeFile';
import { generateExcelToolDefinition, generateExcelFile } from '../system/skills/generateExcel';
import { runTerminalCommandToolDefinition, runTerminalCommand } from '../system/skills/executeShell';
import { browseWebsiteToolDefinition, browseWebsite } from '../system/skills/browseWeb';
import { searchWebToolDefinition, searchWeb } from '../system/skills/searchWeb';

import { editLocalFileToolDefinition, editLocalFile } from '../system/skills/editFile';
import { gitManagerToolDefinition, executeGitCommand } from '../system/skills/gitManager';
import { xManagerToolDefinition, manageTwitter } from '../system/skills/xManager';
import { notionWorkspaceToolDefinition, manageNotion } from '../system/skills/notionWorkspace';
import { audioTranscribeToolDefinition, transcribeAudio } from '../system/skills/audioTranscribe';
import { summarizeTextToolDefinition, summarizeText } from '../system/skills/summarizeText';
import { scheduleTaskDefinition, executeScheduleTask } from '../system/skills/scheduleTask';
import { cancelTaskDefinition, executeCancelTask } from '../system/skills/cancelTask';
import { 
  readGmailInbox, 
  listCalendarEvents, 
  appendRowToSheets, 
  readGoogleDocs, 
  readGoogleFormResponses,
  readGmailInboxToolDefinition,
  listCalendarEventsToolDefinition,
  appendRowToSheetsToolDefinition,
  readGoogleDocsToolDefinition,
  readGoogleFormResponsesToolDefinition
} from '../system/skills/googleWorkspace';

import { getPath } from '../config/paths';
import pc from 'picocolors';

export const logger = new Logger();



const PROVIDER_CONFIGS: Record<string, { baseURL?: string; requiresApiKey: boolean }> = {
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
  const providerConf = PROVIDER_CONFIGS[providerName] || PROVIDER_CONFIGS['openai'];

  let apiKey = 'local';
  if (providerConf.requiresApiKey) {
    apiKey = '';
    const keyName = `${providerName}_key`;
    apiKey = vaultKeys[keyName] || config.credentials?.[keyName] || '';
      
    if (!apiKey) {
      throw new Error(`[Security] No API Key found for ${providerName} in OS Keyring. Please run 'nyxora set-key ${providerName} <key>' or 'nyxora setup'.`);
    }
    console.log(`[LLM] Using API Key securely unlocked from OS Keyring vault.`);
  }

  return new OpenAI({
    baseURL: providerConf.baseURL,
    apiKey: apiKey,
    timeout: 120 * 1000,
    maxRetries: 0
  });
}

async function executeWithRetry(
  requestBuilder: (client: OpenAI) => Promise<any>,
  maxRetries = 3
): Promise<any> {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const client = await getOpenAI();
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

function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'os'): string {
    const config = loadConfig();
    const currentDateTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    let basePrompt = `You are Nyxora's OS Agent (System & Automation Specialist).
The current real-world date and time is: ${currentDateTime}.

Reason internally. Never reveal private reasoning. Provide only concise conclusions, assumptions, and actionable steps.

[OS EXECUTION WORKFLOW]
CRITICAL RULE 1: NEVER expose internal JSON tool calls. Explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt.
CRITICAL RULE 3: FILE SYSTEM SAFETY. You are STRICTLY FORBIDDEN from modifying config.yaml, rpc_key.yaml, or policy.yaml using terminal commands like sed or echo.
CRITICAL RULE 4: CRON JOBS VS LIMIT ORDERS. Do NOT use schedule_task for price-based trading triggers. Use schedule_task for time-based recurring tasks.
CRITICAL RULE 5: TOOL CONFIDENCE. NEVER fabricate file contents or command outputs.`;

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

export async function processOsIntent(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input }, sessionId);

  const history = logger.getHistory(sessionId);
  
  // Format messages for OpenAI
  let activeTools: any[] = [];
  const SYSTEM_TOOLS = [updateProfileToolDefinition, updateIdentityToolDefinition, updateSecurityPolicyToolDefinition, analyzeDocumentToolDefinition, readLocalFileToolDefinition, writeLocalFileToolDefinition, generateExcelToolDefinition, runTerminalCommandToolDefinition, browseWebsiteToolDefinition, searchWebToolDefinition, editLocalFileToolDefinition, gitManagerToolDefinition, xManagerToolDefinition, notionWorkspaceToolDefinition, audioTranscribeToolDefinition, summarizeTextToolDefinition, scheduleTaskDefinition, cancelTaskDefinition];
  const GOOGLE_TOOLS = [readGmailInboxToolDefinition, listCalendarEventsToolDefinition, appendRowToSheetsToolDefinition, readGoogleDocsToolDefinition, readGoogleFormResponsesToolDefinition];
  activeTools = [...SYSTEM_TOOLS, ...GOOGLE_TOOLS].filter(t => isSkillActive(t.function.name));

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');
  const sanitizedHistory = sanitizeHistoryForLLM(history, activeTools);

  let messages: any[] = [
    { role: 'system', content: getSystemPrompt('os') },
    ...sanitizedHistory
  ];

  try {
    const context = 'os';
    const SYSTEM_TOOLS = [updateProfileToolDefinition, updateIdentityToolDefinition, updateSecurityPolicyToolDefinition, analyzeDocumentToolDefinition, readLocalFileToolDefinition, writeLocalFileToolDefinition, generateExcelToolDefinition, runTerminalCommandToolDefinition, browseWebsiteToolDefinition, searchWebToolDefinition, editLocalFileToolDefinition, gitManagerToolDefinition, xManagerToolDefinition, notionWorkspaceToolDefinition, audioTranscribeToolDefinition, summarizeTextToolDefinition, scheduleTaskDefinition, cancelTaskDefinition];
    const GOOGLE_TOOLS = [readGmailInboxToolDefinition, listCalendarEventsToolDefinition, appendRowToSheetsToolDefinition, readGoogleDocsToolDefinition, readGoogleFormResponsesToolDefinition];
    
    let activeTools: any[] = [...SYSTEM_TOOLS, ...GOOGLE_TOOLS];
    activeTools = activeTools.filter(t => isSkillActive(t.function.name));

    const response = await executeWithRetry(async (client) => {
      return await client.chat.completions.create({
          model: config.llm.model,
          temperature: config.llm.temperature,
          messages: messages,
          tools: activeTools,
          tool_choice: "auto",
      });
    });

    const responseMessage = response.choices[0].message;
    
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
          switch (toolName) {
            case 'update_profile': {
              result = updateProfile(args.content, args.mode);
              break;
            }
            case 'update_identity': {
              result = updateIdentity(args.content, args.mode);
              break;
            }
            case 'update_security_policy': {
              result = await updateSecurityPolicy(args.policy, args.action || 'add');
              break;
            }
            case 'analyze_document': {
              result = await analyzeDocument(args.filePath);
              break;
            }
            case 'read_local_file': {
              result = readLocalFile(args.filePath, args.startLine, args.endLine);
              break;
            }
            case 'edit_local_file': {
              result = editLocalFile(args.filePath, args.searchString, args.replacementString);
              break;
            }
            case 'execute_git_command': {
              result = await executeGitCommand(args.action, args.commitMessage);
              break;
            }
            case 'manage_twitter': {
              result = await manageTwitter(args.action, args.content, args.username);
              break;
            }
            case 'manage_notion': {
              result = await manageNotion(args.action, args.pageId, args.text);
              break;
            }
            case 'transcribe_audio': {
              result = await transcribeAudio(args.filePath);
              break;
            }
            case 'summarize_text': {
              result = await summarizeText(args.text, args.focus);
              break;
            }
            case 'write_local_file': {
              result = writeLocalFile(args.filePath, args.content);
              break;
            }
            case 'generate_excel_file': {
              result = await generateExcelFile(args.data, args.filePath);
              break;
            }
            case 'run_terminal_command': {
              result = await runTerminalCommand(args.command);
              break;
            }
            case 'browse_website': {
              result = await browseWebsite(args.url);
              break;
            }
            case 'search_web': {
              result = await searchWeb(args.query, args.depth);
              break;
            }
            case 'schedule_task': {
              result = await executeScheduleTask(args);
              break;
            }
            case 'cancel_task': {
              result = await executeCancelTask(args);
              break;
            }

            case 'read_gmail_inbox': {
              result = await readGmailInbox(args.maxResults);
              break;
            }
            case 'list_calendar_events': {
              result = await listCalendarEvents(args.maxResults);
              break;
            }
            case 'append_row_to_sheets': {
              result = await appendRowToSheets(args.spreadsheetId, args.range, args.values);
              break;
            }
            case 'read_google_docs': {
              result = await readGoogleDocs(args.documentId);
              break;
            }
            case 'read_google_form_responses': {
              result = await readGoogleFormResponses(args.formId);
              break;
            }
            default: {
              result = `Error: Tool ${toolName} is not implemented.`;
              break;
            }
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
      const secondSanitized = sanitizeHistoryForLLM(logger.getHistory(sessionId), activeTools);
      const secondMessages = [
        { role: 'system', content: getSystemPrompt('os') },
        ...secondSanitized
      ];

      const secondResponse = await executeWithRetry(async (client) => {
        return await client.chat.completions.create({
          model: config.llm.model,
          messages: secondMessages,
        });
      });

      if (secondResponse.usage?.total_tokens) {
        Tracker.addTokens(secondResponse.usage.total_tokens, config.llm.provider);
      }
      Tracker.addEvent('llm.final_response', { provider: config.llm.provider });

      let finalContent = secondResponse.choices[0].message.content || "";
      
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
    const errorMsg = '⚠️ All models are temporarily rate-limited. Please try again in a few minutes.';
    logger.addEntry({ role: 'assistant', content: errorMsg }, sessionId);
    return errorMsg;
  }
}
