import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { getBalanceToolDefinition, getBalance } from '../web3/skills/getBalance';
import { transferToolDefinition, prepareTransfer } from '../web3/skills/transfer';
import { getPriceToolDefinition, getPrice } from '../web3/skills/getPrice';
import { swapTokenToolDefinition, prepareSwapToken } from '../web3/skills/swapToken';
import { bridgeTokenToolDefinition, prepareBridgeToken } from '../web3/skills/bridgeToken';
import { isSkillActive } from '../utils/skillManager';
import { mintNftToolDefinition, prepareMintNft } from '../web3/skills/mintNft';
import { customTxToolDefinition, prepareCustomTx } from '../web3/skills/customTx';
import { createWalletToolDefinition, createWallet } from '../web3/skills/createWallet';
import { checkSecurityToolDefinition, checkTokenSecurity } from '../web3/skills/checkSecurity';
import { marketAnalysisToolDefinition, analyzeMarket } from '../web3/skills/marketAnalysis';
import { checkPortfolioToolDefinition, checkPortfolio } from '../web3/skills/checkPortfolio';
import { checkAddressToolDefinition, checkAddress } from '../web3/skills/checkAddress';
import { getMyAddressToolDefinition, getMyAddress } from '../web3/skills/getMyAddress';
import { createLimitOrderToolDefinition, listLimitOrdersToolDefinition, cancelLimitOrderToolDefinition, limitOrderManager } from './limitOrderManager';
import { updateProfileToolDefinition, updateProfile } from './updateProfile';
import { updateSecurityPolicyToolDefinition, updateSecurityPolicy } from '../system/skills/updateSecurityPolicy';
import { analyzeDocumentToolDefinition, analyzeDocument } from '../system/skills/analyzeDocument';
import { readLocalFileToolDefinition, readLocalFile } from '../system/skills/readFile';
import { writeLocalFileToolDefinition, writeLocalFile } from '../system/skills/writeFile';
import { runTerminalCommandToolDefinition, runTerminalCommand } from '../system/skills/executeShell';
import { browseWebsiteToolDefinition, browseWebsite } from '../system/skills/browseWeb';
import { searchWebToolDefinition, searchWeb } from '../system/skills/searchWeb';
import { installExternalSkillToolDefinition, installExternalSkill } from '../system/skills/installSkill';
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
import { pluginManager } from '../system/pluginManager';
import { getPath } from '../config/paths';
import pc from 'picocolors';

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

async function executeWithRetry(
  requestBuilder: (client: OpenAI) => Promise<any>,
  maxRetries = 3
): Promise<any> {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const client = getOpenAI();
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

function getSystemPrompt() {
  const config = loadConfig();
  const currentDateTime = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  let basePrompt = `You are an autonomous Web3 agent operating on EVM chains.
You are equipped with a native wallet.
The current real-world date and time is: ${currentDateTime}. Use this for any time-related questions.

CRITICAL RULE 1: ADVANCED NLP & PERSONA. You must act as a highly intelligent, adaptive, and intuitive assistant (similar to ChatGPT or Gemini). You must seamlessly understand the user's language structure, including slang, shorthand, informal context, and mixed languages. However, you must maintain a professional and highly accurate Web3 operational standard.
CRITICAL RULE 2: LANGUAGE MATCHING. You must always reply in the exact same language that the user uses to talk to you. If the user speaks Indonesian, reply in Indonesian. If they speak English, reply in English.
CRITICAL RULE 3: FORMATTING & CONCISENESS. 
  - Your responses MUST be concise and to the point. Do not add unnecessary fluff or overly long explanations unless explicitly asked.
  - When displaying numbers or monetary values, separate thousands with commas (e.g., $1,000,000) for readability.
  - When displaying a list of assets, tokens, portfolio, or transaction history, YOU MUST USE MARKDOWN TABLES. Do not use bullet points for financial data.
CRITICAL RULE 4: When the user asks to check "my balance", "saldo saya", or anything about their own wallet generally, ALWAYS use the check_portfolio tool to show all assets on the chain that have a USD value greater than 0. LEAVE THE ADDRESS PARAMETER EMPTY. Do NOT use get_balance unless the user explicitly asks for the balance of ONE specific token.
CRITICAL RULE 5: If the user doesn't specify a chain, default to: ${config.agent.default_chain}. If the user mentions a specific chain (e.g., "on BNB", "di Base"), you MUST override the default and execute the tool on that specific chain.
CRITICAL RULE 6: If you use the default chain because the user forgot to specify one, you MUST politely confirm which chain you checked in your response (e.g., "I checked your balance on the ${config.agent.default_chain} network..."). Do not issue scary warnings.`;

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

  // Read security_policy.md for NLP security constraints
  try {
    const policyPath = getPath('security_policy.md');
    if (fs.existsSync(policyPath)) {
      const securityInstructions = fs.readFileSync(policyPath, 'utf8');
      basePrompt += `\n\n--- SECURITY POLICY (MANDATORY RULES) ---\n${securityInstructions}\n\nCRITICAL: If the user asks you to perform an action that violates the Security Policy above, YOU MUST NOT EXECUTE IT DIRECTLY. Instead, ask for their explicit permission first.`;
    }
  } catch (error) {
    console.error('Failed to read security_policy.md:', error);
  }

  return basePrompt;
}

export async function processUserInput(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input }, sessionId);

  const history = logger.getHistory(sessionId);
  
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

    const response = await executeWithRetry(async (client) => {
      return await client.chat.completions.create({
        model: config.llm.model,
        temperature: config.llm.temperature,
        messages: messages,
        tools: [
          getBalanceToolDefinition as any, 
          transferToolDefinition as any, 
          getPriceToolDefinition as any, 
          swapTokenToolDefinition as any,
          bridgeTokenToolDefinition as any,
          mintNftToolDefinition as any,
          customTxToolDefinition as any,
          createWalletToolDefinition as any,
          checkSecurityToolDefinition as any,
          marketAnalysisToolDefinition as any,
          checkPortfolioToolDefinition as any,
          checkAddressToolDefinition as any,
          getMyAddressToolDefinition as any,
          createLimitOrderToolDefinition as any,
          listLimitOrdersToolDefinition as any,
          cancelLimitOrderToolDefinition as any,
          updateProfileToolDefinition as any,
          updateSecurityPolicyToolDefinition as any,
          analyzeDocumentToolDefinition as any,
          readLocalFileToolDefinition as any,
          writeLocalFileToolDefinition as any,
          runTerminalCommandToolDefinition as any,
          browseWebsiteToolDefinition as any,
          searchWebToolDefinition as any,
          installExternalSkillToolDefinition as any,
          readGmailInboxToolDefinition as any,
          listCalendarEventsToolDefinition as any,
          appendRowToSheetsToolDefinition as any,
          readGoogleDocsToolDefinition as any,
          readGoogleFormResponsesToolDefinition as any,
          ...pluginManager.getToolDefinitions()
        ].filter(t => isSkillActive(t.function.name)),
        tool_choice: "auto",
      });
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
    }, sessionId);

    // Check if the model wants to call a tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      for (const _toolCall of responseMessage.tool_calls) {
        const toolCall = _toolCall as any;
        let result = "";
        const args = JSON.parse(toolCall.function.arguments);
        const toolName = toolCall.function.name;

        console.log(pc.yellow(`[⚡ Eksekusi Tool] AI memanggil ${toolName}...`));
        if (onProgress) onProgress(`_⚡ Menjalankan alat: ${toolName}..._`);

        try {
          switch (toolName) {
            case 'get_balance': {
              result = await getBalance(args.chainName, args.address, args.token);
              break;
            }
            case 'transfer_token':
            case 'transfer_native': {
              if (config.permissions?.web3?.allow_transfer === false) {
                result = `[Security Blocked] Runtime Permission Denied: Web3 transfers are disabled. Update config.yaml to allow.`;
                break;
              }
              result = await prepareTransfer(args.chainName, args.toAddress, args.amountStr || args.amountEth, args.token);
              break;
            }
            case 'get_price': {
              result = await getPrice(args.coinId);
              break;
            }
            case 'swap_token': {
              if (config.permissions?.web3?.allow_swap === false) {
                result = `[Security Blocked] Runtime Permission Denied: Web3 swaps are disabled. Update config.yaml to allow.`;
                break;
              }
              // Note: max_usd_per_tx validation would ideally be calculated here before prepareSwapToken
              result = await prepareSwapToken(args.chainName, args.fromToken, args.toToken, args.amountStr || args.amount, args.mode, args.providerName);
              break;
            }
            case 'bridge_token': {
              if (config.permissions?.web3?.allow_transfer === false) {
                result = `[Security Blocked] Runtime Permission Denied: Web3 bridging (transfer) is disabled. Update config.yaml to allow.`;
                break;
              }
              result = await prepareBridgeToken(args.fromChainName, args.toChainName, args.fromToken, args.toToken, args.amountStr, args.mode, args.providerName);
              break;
            }
            case 'mint_nft': {
              result = await prepareMintNft(args.chainName, args.contractAddress, args.functionSignature, args.argsStr, args.valueEth);
              break;
            }
            case 'custom_tx': {
              if (config.permissions?.web3?.allow_transfer === false) {
                result = `[Security Blocked] Runtime Permission Denied: Custom transactions are blocked because transfers are disabled.`;
                break;
              }
              result = await prepareCustomTx(args.chainName, args.toAddress, args.dataHex, args.valueEth, args.gasLimitStr);
              break;
            }
            case 'create_wallet': {
              result = await createWallet();
              break;
            }
            case 'check_token_security': {
              result = await checkTokenSecurity(args.chainName, args.contractAddress);
              break;
            }
            case 'analyze_market': {
              result = await analyzeMarket(args.chainName, args.tokenAddressOrSymbol);
              break;
            }
            case 'check_portfolio': {
              result = await checkPortfolio(args.chainName, args.address);
              break;
            }
            case 'check_address': {
              result = await checkAddress(args.chainName, args.address);
              break;
            }
            case 'get_my_address': {
              result = await getMyAddress();
              break;
            }
            case 'create_limit_order': {
              if (config.permissions?.web3?.allow_swap === false) {
                result = `[Security Blocked] Runtime Permission Denied: Limit orders require swap permissions. Update config.yaml to allow.`;
                break;
              }
              result = limitOrderManager.createOrder(args.chainName, args.fromToken, args.toToken, args.amountStr, args.targetPriceUsd, args.condition);
              break;
            }
            case 'list_limit_orders': {
              result = limitOrderManager.listOrders();
              break;
            }
            case 'cancel_limit_order': {
              result = limitOrderManager.cancelOrder(args.id);
              break;
            }
            case 'update_profile': {
              result = updateProfile(args.content, args.mode);
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
              result = readLocalFile(args.filePath);
              break;
            }
            case 'write_local_file': {
              if (config.permissions?.system?.allow_file_write === false) {
                result = `[Security Blocked] Runtime Permission Denied: File writing is disabled. Update config.yaml to allow.`;
                break;
              }
              result = writeLocalFile(args.filePath, args.content);
              break;
            }
            case 'run_terminal_command': {
              if (config.permissions?.system?.allow_shell_execution === false) {
                result = `[Security Blocked] Runtime Permission Denied: Shell execution is disabled. Update config.yaml to allow.`;
                break;
              }
              result = await runTerminalCommand(args.command);
              break;
            }
            case 'browse_website': {
              result = await browseWebsite(args.url);
              break;
            }
            case 'search_web': {
              result = await searchWeb(args.query);
              break;
            }
            case 'install_external_skill': {
              result = await installExternalSkill(args.url);
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
              const externalResult = await pluginManager.executeTool(toolName, args);
              if (externalResult !== null) {
                result = externalResult;
              } else {
                result = `Error: Tool ${toolName} is not implemented.`;
              }
              break;
            }
          }

          if (result.includes('[Security Blocked]') || result.startsWith('Error:')) {
            console.log(pc.red(`[❌ Gagal] Tool ${toolName} mengembalikan error atau diblokir.`));
          } else {
            console.log(pc.green(`[✅ Sukses] Tool ${toolName} berhasil dieksekusi.`));
          }

        } catch (toolError: any) {
          result = `Error executing ${toolName}: ${toolError.message}`;
          console.log(pc.red(`[❌ Error Crash] Eksekusi ${toolName} gagal total: ${toolError.message}`));
        }

        logger.addEntry({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: result,
        }, sessionId);

        // V2 Optimization: Zero-LLM Fast Return for data-heavy tools
        // If the tool already returns perfectly formatted markdown, skip the second LLM call to save 5-10s latency and tokens!
        if (toolName === 'check_portfolio' || toolName === 'check_address') {
          logger.addEntry({ role: 'assistant', content: result }, sessionId);
          return result;
        }
      }

      // Second call to get the final answer after tool execution
      const secondMessages = [
        { role: 'system', content: getSystemPrompt() },
        ...logger.getHistory(sessionId)
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

      const finalContent = secondResponse.choices[0].message.content || "";
      logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
      return finalContent;
    }

    return responseMessage.content || "No response generated.";
  } catch (error: any) {
    console.error("LLM Error:", error);
    const errorMsg = '⚠️ All models are temporarily rate-limited. Please try again in a few minutes.';
    logger.addEntry({ role: 'assistant', content: errorMsg }, sessionId);
    return errorMsg;
  }
}
