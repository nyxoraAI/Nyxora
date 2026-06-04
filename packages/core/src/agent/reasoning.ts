import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig, loadApiKeys } from '../config/parser';
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

async function getOpenAI(): Promise<OpenAI> {
  const config = loadConfig();
  const vaultKeys = await loadApiKeys();
  const providerName = config.llm.provider || 'openai';
  const providerConf = PROVIDER_CONFIGS[providerName] || PROVIDER_CONFIGS['openai'];

  let apiKey = 'local';
  if (providerConf.requiresApiKey) {
    apiKey = '';
    let configuredKeys = config.llm.api_keys;
    if (typeof configuredKeys === 'string') {
      configuredKeys = [configuredKeys];
    }
    
    if (Array.isArray(configuredKeys) && configuredKeys.length > 0) {
      const keys = configuredKeys.filter(k => typeof k === 'string' && k.trim() !== '');
      if (keys.length > 0) {
        currentKeyIndex = currentKeyIndex % keys.length;
        apiKey = keys[currentKeyIndex];
        console.log(`[LLM] Using rotated API Key (${currentKeyIndex + 1}/${keys.length}): ${apiKey.substring(0, 4)}...`);
        currentKeyIndex++;
      }
    }

    if (!apiKey) {
      const fallbackKeyName = `${providerName}_key`;
      apiKey = vaultKeys[fallbackKeyName] || config.credentials?.[fallbackKeyName] || '';
      
      if (!apiKey) {
        throw new Error(`No API Key found for ${providerName}. Please run 'nyxora setup' to configure it.`);
      }
      console.log(`[LLM] Using API Key from secure vault`);
    }
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

function getSystemPrompt() {
  const config = loadConfig();
  const currentDateTime = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  let basePrompt = `You are an autonomous Web3 agent operating on EVM chains.
You are equipped with a native wallet.
The current real-world date and time is: ${currentDateTime}. Use this for any time-related questions.

CRITICAL RULE 1: ADVANCED NLP & PERSONA. You must act as a highly intelligent, adaptive, and intuitive assistant (similar to ChatGPT or Gemini). You must seamlessly understand the user's language structure, including slang, shorthand, informal context, and mixed languages. However, you must maintain a professional and highly accurate Web3 operational standard.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. You MUST strictly reply in the exact same language as the user's LATEST prompt. If the user's latest prompt is in English, you MUST reply entirely in English, completely ignoring the language of previous messages. If their latest prompt is in Indonesian, reply in Indonesian.
CRITICAL RULE 3: FORMATTING & CONCISENESS. 
  - Your responses MUST be concise and to the point. Do not add unnecessary fluff or overly long explanations unless explicitly asked.
  - When displaying numbers or monetary values, separate thousands with commas (e.g., $1,000,000) for readability.
  - When displaying a list of assets, tokens, portfolio, or transaction history, YOU MUST USE MARKDOWN TABLES. Do not use bullet points for financial data.
CRITICAL RULE 4: When the user asks to check "my balance", "saldo saya", or anything about their own wallet generally, ALWAYS use the check_portfolio tool to show all assets on the chain that have a USD value greater than 0. LEAVE THE ADDRESS PARAMETER EMPTY. Do NOT use get_balance unless the user explicitly asks for the balance of ONE specific token.
CRITICAL RULE 5: If the user doesn't specify a chain, default to: ${config.agent.default_chain}. If the user mentions a specific chain (e.g., "on BNB", "di Base"), you MUST override the default and execute the tool on that specific chain.
CRITICAL RULE 6: If you use the default chain because the user forgot to specify one, you MUST politely confirm which chain you checked in your response (e.g., "I checked your balance on the ${config.agent.default_chain} network..."). Do not issue scary warnings.
CRITICAL RULE 7: TOOL PRIORITIZATION. When the user asks about crypto prices, market analysis, token security, or blockchain data, YOU MUST prioritize using the dedicated Web3 skills (e.g., get_price, analyze_market, check_security) FIRST. Only if those tools fail or cannot provide the requested information, you may fallback to using search_web.`;

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

    // --- v1.7.4 Semantic Keyword Router ---
    const lowerInput = input.toLowerCase();
    const hasWeb3Keyword = /swap|transfer|price|token|crypto|bridge|wallet|balance|portfolio|buy|sell|send|receive|address|market|limit|mint|nft/i.test(lowerInput);
    const hasGoogleKeyword = /email|gmail|calendar|sheet|doc|form|event/i.test(lowerInput);

    const WEB3_TOOLS = [getBalanceToolDefinition, transferToolDefinition, getPriceToolDefinition, swapTokenToolDefinition, bridgeTokenToolDefinition, mintNftToolDefinition, customTxToolDefinition, createWalletToolDefinition, checkSecurityToolDefinition, marketAnalysisToolDefinition, checkPortfolioToolDefinition, checkAddressToolDefinition, getMyAddressToolDefinition, createLimitOrderToolDefinition, listLimitOrdersToolDefinition, cancelLimitOrderToolDefinition];
    const SYSTEM_TOOLS = [updateProfileToolDefinition, updateSecurityPolicyToolDefinition, analyzeDocumentToolDefinition, readLocalFileToolDefinition, writeLocalFileToolDefinition, runTerminalCommandToolDefinition, browseWebsiteToolDefinition, searchWebToolDefinition, installExternalSkillToolDefinition];
    const GOOGLE_TOOLS = [readGmailInboxToolDefinition, listCalendarEventsToolDefinition, appendRowToSheetsToolDefinition, readGoogleDocsToolDefinition, readGoogleFormResponsesToolDefinition];

    let activeTools: any[] = [];
    if (hasGoogleKeyword && !hasWeb3Keyword) {
      activeTools = [...GOOGLE_TOOLS, ...SYSTEM_TOOLS, ...pluginManager.getToolDefinitions()];
    } else if (hasWeb3Keyword && !hasGoogleKeyword) {
      activeTools = [...WEB3_TOOLS, ...SYSTEM_TOOLS, ...pluginManager.getToolDefinitions()];
    } else {
      activeTools = [...WEB3_TOOLS, ...SYSTEM_TOOLS, ...GOOGLE_TOOLS, ...pluginManager.getToolDefinitions()];
    }
    activeTools = activeTools.filter(t => isSkillActive(t.function.name));
    // ----------------------------------------

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
              result = await searchWeb(args.query, args.depth);
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

        // V2 Optimization (Expanded in v1.7.4): Zero-LLM Fast Return for data-heavy and read-only tools
        // If the tool already returns perfectly formatted markdown, skip the second LLM call to save 5-10s latency and tokens!
        const fastReturnTools = [
          'check_portfolio', 'check_address', 'get_price', 'get_my_address',
          'analyze_market', 'check_token_security', 'search_web', 'read_gmail_inbox', 'list_calendar_events'
        ];
        if (fastReturnTools.includes(toolName)) {
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
