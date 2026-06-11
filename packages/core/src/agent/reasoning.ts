import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';
import { getBalanceToolDefinition, getBalance } from '../web3/skills/getBalance';
import { transferToolDefinition, prepareTransfer } from '../web3/skills/transfer';
import { getPriceToolDefinition, getPrice } from '../web3/skills/getPrice';
import { swapTokenToolDefinition, prepareSwapToken } from '../web3/skills/swapToken';
import { bridgeTokenToolDefinition, prepareBridgeToken } from '../web3/skills/bridgeToken';
import { isSkillActive } from '../utils/skillManager';
import { mintNftToolDefinition, prepareMintNft } from '../web3/skills/mintNft';
import { customTxToolDefinition, prepareCustomTx } from '../web3/skills/customTx';

import { checkSecurityToolDefinition, checkTokenSecurity } from '../web3/skills/checkSecurity';
import { marketAnalysisToolDefinition, analyzeMarket } from '../web3/skills/marketAnalysis';
import { checkPortfolioToolDefinition, checkPortfolio } from '../web3/skills/checkPortfolio';
import { checkAddressToolDefinition, checkAddress } from '../web3/skills/checkAddress';
import { getMyAddressToolDefinition, getMyAddress } from '../web3/skills/getMyAddress';
import { manageCustomTokensDefinition, executeManageCustomTokens } from '../web3/skills/manageCustomTokens';
import { revokeApprovalToolDefinition, prepareRevokeApproval } from '../web3/skills/revokeApprovals';
import { aaveSupplyToolDefinition, prepareAaveSupply } from '../web3/skills/defiLending';
import { vaultDepositToolDefinition, prepareVaultDeposit } from '../web3/skills/yieldVault';
import { provideLiquidityToolDefinition, prepareProvideLiquidity } from '../web3/skills/provideLiquidity';
import { getTxHistoryToolDefinition, getTxHistory } from '../web3/skills/getTxHistory';

import { updateProfileToolDefinition, updateProfile } from './updateProfile';
import { updateSecurityPolicyToolDefinition, updateSecurityPolicy } from '../system/skills/updateSecurityPolicy';
import { analyzeDocumentToolDefinition, analyzeDocument } from '../system/skills/analyzeDocument';
import { readLocalFileToolDefinition, readLocalFile } from '../system/skills/readFile';
import { writeLocalFileToolDefinition, writeLocalFile } from '../system/skills/writeFile';
import { generateExcelToolDefinition, generateExcelFile } from '../system/skills/generateExcel';
import { runTerminalCommandToolDefinition, runTerminalCommand } from '../system/skills/executeShell';
import { browseWebsiteToolDefinition, browseWebsite } from '../system/skills/browseWeb';
import { searchWebToolDefinition, searchWeb } from '../system/skills/searchWeb';
import { installExternalSkillToolDefinition, installExternalSkill } from '../system/skills/installSkill';
import { editLocalFileToolDefinition, editLocalFile } from '../system/skills/editFile';
import { gitManagerToolDefinition, executeGitCommand } from '../system/skills/gitManager';
import { xManagerToolDefinition, manageTwitter } from '../system/skills/xManager';
import { notionWorkspaceToolDefinition, manageNotion } from '../system/skills/notionWorkspace';
import { audioTranscribeToolDefinition, transcribeAudio } from '../system/skills/audioTranscribe';
import { summarizeTextToolDefinition, summarizeText } from '../system/skills/summarizeText';
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

function getSystemPrompt() {
  const config = loadConfig();
  const currentDateTime = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  let basePrompt = `You are an autonomous Web3 agent operating on EVM chains.
You are equipped with a native wallet.
The current real-world date and time is: ${currentDateTime}. Use this for any time-related questions.

CRITICAL RULE 1: NEVER expose internal JSON tool calls to the user. Always parse them and explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. You MUST strictly reply in the exact same language as the user's LATEST prompt.
CRITICAL RULE 3: FORMATTING & CONCISENESS. Be concise. Use markdown tables for lists of assets/transactions. Use commas for thousands.
CRITICAL RULE 4: TOOL PRIORITIZATION. Web3 tasks must use Web3 Skills exclusively. OS Skills (search, browse) are fallbacks only. Use get_my_address to show wallet address, and check_portfolio to show balances.
CRITICAL RULE 5: DEFAULT CHAIN HANDLING. Default to: ${config.agent.default_chain} unless specified. If overridden, confirm the chain politely. For 2-chain txs (bridge), default source to ${config.agent.default_chain}.
CRITICAL RULE 6: NETWORK SAFETY VALIDATION. If a request implies cross-chain or mainnet/testnet mixing, or the token symbol is ambiguous (USDC vs USDC.e), YOU MUST NOT GUESS. Ask for confirmation.
CRITICAL RULE 7: TOOL CONFIDENCE & HALUCINATION PREVENTION. NEVER fabricate blockchain data. If a tool fails or data is missing, state it explicitly. Do not estimate balances, prices, APY, or gas.
CRITICAL RULE 8: CONDITIONAL PARALLEL EXECUTION. Parallel tool execution is ONLY allowed if there are zero data dependencies between them.
CRITICAL RULE 9: DEFI CONFIGURATION FALLBACK. If a tool fails due to Rate Limits, Unauthorized, or Missing API Keys, instruct the user to visit the "DeFi Configuration 🔑" menu in the dashboard.
CRITICAL RULE 10: PLANNING & RISK DISCLOSURE. For high-level instructions (e.g. "Get yield"), formulate a plan and briefly disclose major risks (smart contract risk, impermanent loss) before asking for approval.
CRITICAL RULE 11: FAST RETURN RULE. If parameters for read-only tools are complete, execute them IMMEDIATELY without preamble or conversational filler.
CRITICAL RULE 12: SMART SLIPPAGE AWARENESS. For low-liquidity assets, warn the user that default slippage might not be enough. NEVER invent specific slippage percentage numbers.
CRITICAL RULE 13: WALLET CONTEXT CACHING. Portfolio data in chat history is potentially stale. Do not use cached data for transactional planning; refresh the balance via tools first.
CRITICAL RULE 14: TRANSACTION EXECUTION. For ALL state-changing transactions (swap, bridge, transfer, stake), do NOT ask for verbal confirmation. Execute the tool IMMEDIATELY. The tool itself will trigger a secure popup in the user's dashboard UI for final approval.
CRITICAL RULE 16: CAPABILITY HONESTY. NEVER claim a capability not available through installed tools. If asked for an unsupported action, state honestly that the skill is missing.
CRITICAL RULE 17: MINIMIZE UNNECESSARY TOOL CALLS. Do not call tools if the answer exists in recent verified context and freshness is not strictly required. Use history to save latency.`;

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

  // Inject Episodic Memories (Smart Suggestions Context)
  try {
    const recentMemories = episodicDB.getMemories().slice(0, 10);
    if (recentMemories.length > 0) {
      basePrompt += `\n\n--- EPISODIC MEMORIES (SMART SUGGESTIONS) ---\nUse these recent observations to proactively suggest or autocomplete parameters (like networks or tokens) without asking the user if they align with the current request:\n`;
      recentMemories.forEach(mem => {
        basePrompt += `- [${mem.category.toUpperCase()}] ${mem.fact} (Confidence: ${(mem.confidence * 100).toFixed(0)}%)\n`;
      });
    }
  } catch (error) {
    // Ignore db errors if not initialized
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

    const lowerInput = input.toLowerCase();
    const hasWeb3Keyword = /swap|transfer|price|token|crypto|bridge|wallet|balance|portfolio|buy|sell|send|receive|address|market|limit|mint|nft/i.test(lowerInput);
    const hasGoogleKeyword = /email|gmail|calendar|sheet|doc|form|event/i.test(lowerInput);

    let tools: any[] = [];
    if (isSkillActive('web3')) {
      tools.push(
        getBalanceToolDefinition,
        transferToolDefinition,
        getPriceToolDefinition,
        swapTokenToolDefinition,
        bridgeTokenToolDefinition,
        mintNftToolDefinition,
        customTxToolDefinition,
        checkSecurityToolDefinition,
        marketAnalysisToolDefinition,
        checkPortfolioToolDefinition,
        checkAddressToolDefinition,
        getMyAddressToolDefinition,
        manageCustomTokensDefinition,

        revokeApprovalToolDefinition,
        aaveSupplyToolDefinition,
        vaultDepositToolDefinition,
        provideLiquidityToolDefinition,
        getTxHistoryToolDefinition
      );
    }
    const SYSTEM_TOOLS = [updateProfileToolDefinition, updateSecurityPolicyToolDefinition, analyzeDocumentToolDefinition, readLocalFileToolDefinition, writeLocalFileToolDefinition, generateExcelToolDefinition, runTerminalCommandToolDefinition, browseWebsiteToolDefinition, searchWebToolDefinition, installExternalSkillToolDefinition, editLocalFileToolDefinition, gitManagerToolDefinition, xManagerToolDefinition, notionWorkspaceToolDefinition, audioTranscribeToolDefinition, summarizeTextToolDefinition];
    const GOOGLE_TOOLS = [readGmailInboxToolDefinition, listCalendarEventsToolDefinition, appendRowToSheetsToolDefinition, readGoogleDocsToolDefinition, readGoogleFormResponsesToolDefinition];

    let activeTools: any[] = [];
    if (hasGoogleKeyword && !hasWeb3Keyword) {
      activeTools = [...GOOGLE_TOOLS, ...SYSTEM_TOOLS, ...pluginManager.getToolDefinitions()];
    } else if (hasWeb3Keyword && !hasGoogleKeyword) {
      activeTools = [...tools, ...SYSTEM_TOOLS, ...pluginManager.getToolDefinitions()];
    } else {
      activeTools = [...tools, ...SYSTEM_TOOLS, ...GOOGLE_TOOLS, ...pluginManager.getToolDefinitions()];
    }
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
      const fastReturnTools = [
        'check_portfolio', 'check_address', 'get_price', 'get_my_address',
        'analyze_market', 'check_token_security', 'search_web', 'read_gmail_inbox', 'list_calendar_events'
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
              result = await prepareSwapToken(args.chainName, args.fromToken, args.toToken, args.amountStr || args.amount, args.mode, args.providerName);
              break;
            }
            case 'bridge_token': {
              if (config.permissions?.web3?.allow_transfer === false) {
                result = `[Security Blocked] Runtime Permission Denied: Web3 bridging (transfer) is disabled. Update config.yaml to allow.`;
                break;
              }
              result = await prepareBridgeToken(args.fromChain, args.toChain, args.tokenSymbol, args.amountStr, args.mode, args.providerName);
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
            case 'manage_custom_tokens': {
              result = await executeManageCustomTokens(args);
              break;
            }
            case 'revoke_approval': {
              result = await prepareRevokeApproval(
                args.chainName,
                args.tokenAddressOrSymbol,
                args.spenderAddress
              );
              break;
            }
            case 'supply_aave': {
              result = await prepareAaveSupply(
                args.chainName,
                args.tokenAddressOrSymbol,
                args.amountStr
              );
              break;
            }
            case 'deposit_yield_vault': {
              result = await prepareVaultDeposit(
                args.chainName,
                args.protocol || 'beefy',
                args.vaultAddress,
                args.tokenAddressOrSymbol,
                args.amountStr
              );
              break;
            }
            case 'provide_liquidity_v3': {
              result = await prepareProvideLiquidity(
                args.chainName,
                args.token0AddressOrSymbol,
                args.token1AddressOrSymbol,
                args.amount0Str,
                args.amount1Str,
                args.feeTier,
                args.tickLower,
                args.tickUpper
              );
              break;
            }
            case 'get_tx_history': {
              result = await getTxHistory(args.chainName, args.address, args.days);
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
              if (config.permissions?.system?.allow_file_write === false) {
                result = `[Security Blocked] Runtime Permission Denied: File writing is disabled. Update config.yaml to allow.`;
                break;
              }
              result = writeLocalFile(args.filePath, args.content);
              break;
            }
            case 'generate_excel_file': {
              if (config.permissions?.system?.allow_file_write === false) {
                result = `[Security Blocked] Runtime Permission Denied: File writing is disabled. Update config.yaml to allow.`;
                break;
              }
              result = await generateExcelFile(args.data, args.filePath);
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
