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
import { createMarketWatchAgentToolDefinition, createMarketWatchAgent } from '../web3/skills/createMarketWatchAgent';
import { checkPortfolioToolDefinition, checkPortfolio } from '../web3/skills/checkPortfolio';
import { checkAddressToolDefinition, checkAddress } from '../web3/skills/checkAddress';
import { getMyAddressToolDefinition, getMyAddress } from '../web3/skills/getMyAddress';
import { manageCustomTokensDefinition, executeManageCustomTokens } from '../web3/skills/manageCustomTokens';
import { revokeApprovalToolDefinition, prepareRevokeApproval } from '../web3/skills/revokeApprovals';
import { aaveSupplyToolDefinition, prepareAaveSupply } from '../web3/skills/defiLending';
import { vaultDepositToolDefinition, prepareVaultDeposit } from '../web3/skills/yieldVault';
import { provideLiquidityToolDefinition, prepareProvideLiquidity } from '../web3/skills/provideLiquidity';
import { getTxHistoryToolDefinition, getTxHistory } from '../web3/skills/getTxHistory';
import { createLimitOrderToolDefinition, createLimitOrder } from '../web3/skills/createLimitOrder';
import { checkRegistryStatusToolDefinition, checkRegistryStatus } from '../web3/skills/checkRegistryStatus';
import { browseWebsiteToolDefinition, browseWebsite } from '../system/skills/browseWeb';
import { searchWebToolDefinition, searchWeb } from '../system/skills/searchWeb';



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

function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'web3'): string {
    const config = loadConfig();
    const currentDateTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
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
CRITICAL RULE 8: AMOUNT PRECISION. Use 6 decimal places for precision, or 2 if >$10,000.`;

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

export async function processWeb3Intent(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const config = loadConfig();
  // Add input to memory
  logger.addEntry({ role, content: input }, sessionId);

  const history = logger.getHistory(sessionId);
  
  // Format messages for OpenAI
  let tools: any[] = [];
  if (isSkillActive('web3')) {
    tools.push(
      getBalanceToolDefinition, transferToolDefinition, getPriceToolDefinition, swapTokenToolDefinition,
      bridgeTokenToolDefinition, mintNftToolDefinition, customTxToolDefinition, checkSecurityToolDefinition,
      marketAnalysisToolDefinition, createMarketWatchAgentToolDefinition, checkPortfolioToolDefinition,
      checkAddressToolDefinition, getMyAddressToolDefinition, manageCustomTokensDefinition,
      revokeApprovalToolDefinition, aaveSupplyToolDefinition, vaultDepositToolDefinition,
      provideLiquidityToolDefinition, getTxHistoryToolDefinition, createLimitOrderToolDefinition,
      checkRegistryStatusToolDefinition
    );
  }
  let activeTools = [...tools, browseWebsiteToolDefinition, searchWebToolDefinition];
  activeTools = activeTools.filter(t => isSkillActive(t.function.name));

  const { sanitizeHistoryForLLM } = require('../utils/historySanitizer');
  const sanitizedHistory = sanitizeHistoryForLLM(history, activeTools);

  let messages: any[] = [
    { role: 'system', content: getSystemPrompt('web3') },
    ...sanitizedHistory
  ];

  try {
    const context = 'web3';

    const response = await executeWithRetry(async (client) => {
      // Debug log to find out why Gemini 400 error happens
      console.log(`[LLM Debug] Sending ${messages.length} messages to LLM.`);
      console.log(JSON.stringify(messages, null, 2));
      
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
            case 'get_balance': {
              result = await getBalance(args.chainName, args.address, args.token);
              break;
            }
            case 'transfer_token':
            case 'transfer_native': {
              result = await prepareTransfer(args.chainName, args.toAddress, args.amountStr || args.amountEth, args.token);
              break;
            }
            case 'get_price': {
              result = await getPrice(args.coinId, args.currency);
              break;
            }
            case 'swap_token': {
              result = await prepareSwapToken(args.chainName, args.fromToken, args.toToken, args.amountStr || args.amount, args.mode, args.providerName);
              break;
            }
            case 'bridge_token': {
              result = await prepareBridgeToken(args.fromChain, args.toChain, args.tokenSymbol, args.amountStr, args.mode, args.providerName);
              break;
            }
            case 'mint_nft': {
              result = await prepareMintNft(args.chainName, args.contractAddress, args.functionSignature, args.argsStr, args.valueEth);
              break;
            }
            case 'custom_tx': {
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
            case 'create_market_watch_agent': {
              result = await createMarketWatchAgent(args.chainName, args.contractAddress, args.rules, args.durationDays);
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
            case 'check_registry_status': {
              const registryResult = await checkRegistryStatus();
              result = JSON.stringify(registryResult);
              break;
            }
            case 'create_limit_order': {
              result = await createLimitOrder(
                args.tokenSymbol,
                args.tokenAddress,
                args.triggerCondition as any,
                args.triggerPriceUsd,
                args.action as any,
                args.amountUsd,
                args.slippageTolerance
              );
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
        { role: 'system', content: getSystemPrompt('web3') },
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
