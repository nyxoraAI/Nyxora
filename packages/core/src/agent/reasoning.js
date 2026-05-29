"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.processUserInput = processUserInput;
const fs_1 = __importDefault(require("fs"));
const openai_1 = require("openai");
const parser_1 = require("../config/parser");
const logger_1 = require("../memory/logger");
const tracker_1 = require("../gateway/tracker");
const getBalance_1 = require("../web3/skills/getBalance");
const transfer_1 = require("../web3/skills/transfer");
const getPrice_1 = require("../web3/skills/getPrice");
const swapToken_1 = require("../web3/skills/swapToken");
const bridgeToken_1 = require("../web3/skills/bridgeToken");
const mintNft_1 = require("../web3/skills/mintNft");
const customTx_1 = require("../web3/skills/customTx");
const createWallet_1 = require("../web3/skills/createWallet");
const checkSecurity_1 = require("../web3/skills/checkSecurity");
const marketAnalysis_1 = require("../web3/skills/marketAnalysis");
const checkPortfolio_1 = require("../web3/skills/checkPortfolio");
const checkAddress_1 = require("../web3/skills/checkAddress");
const getMyAddress_1 = require("../web3/skills/getMyAddress");
const limitOrderManager_1 = require("./limitOrderManager");
const updateProfile_1 = require("./updateProfile");
const updateSecurityPolicy_1 = require("../system/skills/updateSecurityPolicy");
const readFile_1 = require("../system/skills/readFile");
const writeFile_1 = require("../system/skills/writeFile");
const executeShell_1 = require("../system/skills/executeShell");
const browseWeb_1 = require("../system/skills/browseWeb");
const installSkill_1 = require("../system/skills/installSkill");
const pluginManager_1 = require("../system/pluginManager");
const paths_1 = require("../config/paths");
const picocolors_1 = __importDefault(require("picocolors"));
exports.logger = new logger_1.Logger();
let currentKeyIndex = 0;
function getOpenAI() {
    const config = (0, parser_1.loadConfig)();
    if (config.llm.provider === 'ollama') {
        return new openai_1.OpenAI({
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
        }
        else if (config.llm.provider === 'openrouter') {
            apiKey = config.llm.credentials?.openrouter_key || '';
        }
        else {
            apiKey = config.llm.credentials?.openai_key || '';
        }
        if (!apiKey) {
            throw new Error(`No API Key found for ${config.llm.provider} in config.yaml. Please run 'nyxora setup' to configure it.`);
        }
        console.log(`[LLM] Using default API Key from config.yaml`);
    }
    if (config.llm.provider === 'gemini') {
        return new openai_1.OpenAI({
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            apiKey: apiKey,
        });
    }
    else if (config.llm.provider === 'openrouter') {
        return new openai_1.OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: apiKey,
        });
    }
    else {
        return new openai_1.OpenAI({
            apiKey: apiKey,
        });
    }
}
async function executeWithRetry(requestBuilder, maxRetries = 3) {
    let retries = 0;
    while (retries <= maxRetries) {
        try {
            const client = getOpenAI();
            return await requestBuilder(client);
        }
        catch (error) {
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
                if (retries > maxRetries)
                    throw error;
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
    const config = (0, parser_1.loadConfig)();
    let basePrompt = `You are an autonomous Web3 agent operating on EVM chains.
You are equipped with a native wallet. 
CRITICAL RULE: You must always reply in the exact same language that the user uses to talk to you. If the user speaks Indonesian, reply in Indonesian. If they speak English, reply in English.
CRITICAL RULE: If the user asks to check "my balance", "saldo saya", or anything about their own wallet, DO NOT ask them for an address. You must immediately call the get_balance tool and LEAVE THE ADDRESS PARAMETER EMPTY. The system will automatically use the injected private key wallet.
Always use the tools to interact with the blockchain.
If the user doesn't specify a chain, default to: ${config.agent.default_chain}.`;
    // Read IDENTITY.md for core AI persona
    try {
        const identityMdPath = (0, paths_1.getPath)('IDENTITY.md');
        if (fs_1.default.existsSync(identityMdPath)) {
            const identityInstructions = fs_1.default.readFileSync(identityMdPath, 'utf8');
            basePrompt += `\n\n--- CORE IDENTITY & PERSONA ---\n${identityInstructions}`;
        }
    }
    catch (error) {
        console.error('Failed to read IDENTITY.md:', error);
    }
    // Read user.md for custom instructions
    try {
        const userMdPath = (0, paths_1.getPath)('user.md');
        if (fs_1.default.existsSync(userMdPath)) {
            const customInstructions = fs_1.default.readFileSync(userMdPath, 'utf8');
            basePrompt += `\n\n--- CUSTOM USER INSTRUCTIONS ---\n${customInstructions}`;
        }
    }
    catch (error) {
        console.error('Failed to read user.md:', error);
    }
    // Read security_policy.md for NLP security constraints
    try {
        const policyPath = (0, paths_1.getPath)('security_policy.md');
        if (fs_1.default.existsSync(policyPath)) {
            const securityInstructions = fs_1.default.readFileSync(policyPath, 'utf8');
            basePrompt += `\n\n--- SECURITY POLICY (MANDATORY RULES) ---\n${securityInstructions}\n\nCRITICAL: If the user asks you to perform an action that violates the Security Policy above, YOU MUST NOT EXECUTE IT DIRECTLY. Instead, ask for their explicit permission first.`;
        }
    }
    catch (error) {
        console.error('Failed to read security_policy.md:', error);
    }
    return basePrompt;
}
async function processUserInput(input, role = 'user', onProgress) {
    const config = (0, parser_1.loadConfig)();
    // Add input to memory
    exports.logger.addEntry({ role, content: input });
    const history = exports.logger.getHistory();
    // Format messages for OpenAI
    const messages = [
        { role: 'system', content: getSystemPrompt() },
        ...history
            .filter(m => !(m.role === 'tool' && !m.tool_call_id))
            .map(m => {
            let role = m.role;
            if (role === 'system')
                role = 'user';
            const msg = { role, content: m.content || "" };
            if (m.name)
                msg.name = m.name;
            if (m.tool_call_id)
                msg.tool_call_id = m.tool_call_id;
            if (m.tool_calls)
                msg.tool_calls = m.tool_calls;
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
                    getBalance_1.getBalanceToolDefinition,
                    transfer_1.transferToolDefinition,
                    getPrice_1.getPriceToolDefinition,
                    swapToken_1.swapTokenToolDefinition,
                    bridgeToken_1.bridgeTokenToolDefinition,
                    mintNft_1.mintNftToolDefinition,
                    customTx_1.customTxToolDefinition,
                    createWallet_1.createWalletToolDefinition,
                    checkSecurity_1.checkSecurityToolDefinition,
                    marketAnalysis_1.marketAnalysisToolDefinition,
                    checkPortfolio_1.checkPortfolioToolDefinition,
                    checkAddress_1.checkAddressToolDefinition,
                    getMyAddress_1.getMyAddressToolDefinition,
                    limitOrderManager_1.createLimitOrderToolDefinition,
                    limitOrderManager_1.listLimitOrdersToolDefinition,
                    limitOrderManager_1.cancelLimitOrderToolDefinition,
                    updateProfile_1.updateProfileToolDefinition,
                    updateSecurityPolicy_1.updateSecurityPolicyToolDefinition,
                    readFile_1.readLocalFileToolDefinition,
                    writeFile_1.writeLocalFileToolDefinition,
                    executeShell_1.runTerminalCommandToolDefinition,
                    browseWeb_1.browseWebsiteToolDefinition,
                    installSkill_1.installExternalSkillToolDefinition,
                    ...pluginManager_1.pluginManager.getToolDefinitions()
                ],
                tool_choice: "auto",
            });
        });
        const responseMessage = response.choices[0].message;
        // Log tracking
        tracker_1.Tracker.addMessage();
        if (response.usage?.total_tokens) {
            tracker_1.Tracker.addTokens(response.usage.total_tokens, config.llm.provider);
        }
        tracker_1.Tracker.addEvent('llm.response', { provider: config.llm.provider, tool_calls: responseMessage.tool_calls?.length || 0 });
        // Log assistant response
        exports.logger.addEntry({
            role: 'assistant',
            content: responseMessage.content || "",
            tool_calls: responseMessage.tool_calls,
        });
        // Check if the model wants to call a tool
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            for (const _toolCall of responseMessage.tool_calls) {
                const toolCall = _toolCall;
                let result = "";
                const args = JSON.parse(toolCall.function.arguments);
                const toolName = toolCall.function.name;
                console.log(picocolors_1.default.yellow(`[⚡ Eksekusi Tool] AI memanggil ${toolName}...`));
                if (onProgress)
                    onProgress(`_⚡ Menjalankan alat: ${toolName}..._`);
                try {
                    switch (toolName) {
                        case 'get_balance': {
                            result = await (0, getBalance_1.getBalance)(args.chainName, args.address, args.token);
                            break;
                        }
                        case 'transfer_token':
                        case 'transfer_native': {
                            if (config.permissions?.web3?.allow_transfer === false) {
                                result = `[Security Blocked] Runtime Permission Denied: Web3 transfers are disabled. Update config.yaml to allow.`;
                                break;
                            }
                            result = await (0, transfer_1.prepareTransfer)(args.chainName, args.toAddress, args.amountStr || args.amountEth, args.token);
                            break;
                        }
                        case 'get_price': {
                            result = await (0, getPrice_1.getPrice)(args.coinId);
                            break;
                        }
                        case 'swap_token': {
                            if (config.permissions?.web3?.allow_swap === false) {
                                result = `[Security Blocked] Runtime Permission Denied: Web3 swaps are disabled. Update config.yaml to allow.`;
                                break;
                            }
                            // Note: max_usd_per_tx validation would ideally be calculated here before prepareSwapToken
                            result = await (0, swapToken_1.prepareSwapToken)(args.chainName, args.fromToken, args.toToken, args.amountStr || args.amount, args.mode, args.providerName);
                            break;
                        }
                        case 'bridge_token': {
                            if (config.permissions?.web3?.allow_transfer === false) {
                                result = `[Security Blocked] Runtime Permission Denied: Web3 bridging (transfer) is disabled. Update config.yaml to allow.`;
                                break;
                            }
                            result = await (0, bridgeToken_1.prepareBridgeToken)(args.fromChainName, args.toChainName, args.fromToken, args.toToken, args.amountStr, args.mode, args.providerName);
                            break;
                        }
                        case 'mint_nft': {
                            result = await (0, mintNft_1.prepareMintNft)(args.chainName, args.contractAddress, args.functionSignature, args.argsStr, args.valueEth);
                            break;
                        }
                        case 'custom_tx': {
                            if (config.permissions?.web3?.allow_transfer === false) {
                                result = `[Security Blocked] Runtime Permission Denied: Custom transactions are blocked because transfers are disabled.`;
                                break;
                            }
                            result = await (0, customTx_1.prepareCustomTx)(args.chainName, args.toAddress, args.dataHex, args.valueEth, args.gasLimitStr);
                            break;
                        }
                        case 'create_wallet': {
                            result = await (0, createWallet_1.createWallet)();
                            break;
                        }
                        case 'check_token_security': {
                            result = await (0, checkSecurity_1.checkTokenSecurity)(args.chainName, args.contractAddress);
                            break;
                        }
                        case 'analyze_market': {
                            result = await (0, marketAnalysis_1.analyzeMarket)(args.chainName, args.tokenAddressOrSymbol);
                            break;
                        }
                        case 'check_portfolio': {
                            result = await (0, checkPortfolio_1.checkPortfolio)(args.chainName, args.address);
                            break;
                        }
                        case 'check_address': {
                            result = await (0, checkAddress_1.checkAddress)(args.chainName, args.address);
                            break;
                        }
                        case 'get_my_address': {
                            result = await (0, getMyAddress_1.getMyAddress)();
                            break;
                        }
                        case 'create_limit_order': {
                            if (config.permissions?.web3?.allow_swap === false) {
                                result = `[Security Blocked] Runtime Permission Denied: Limit orders require swap permissions. Update config.yaml to allow.`;
                                break;
                            }
                            result = limitOrderManager_1.limitOrderManager.createOrder(args.chainName, args.fromToken, args.toToken, args.amountStr, args.targetPriceUsd, args.condition);
                            break;
                        }
                        case 'list_limit_orders': {
                            result = limitOrderManager_1.limitOrderManager.listOrders();
                            break;
                        }
                        case 'cancel_limit_order': {
                            result = limitOrderManager_1.limitOrderManager.cancelOrder(args.id);
                            break;
                        }
                        case 'update_profile': {
                            result = (0, updateProfile_1.updateProfile)(args.content, args.mode);
                            break;
                        }
                        case 'update_security_policy': {
                            result = (0, updateSecurityPolicy_1.updateSecurityPolicy)(args.rule, args.action);
                            break;
                        }
                        case 'read_local_file': {
                            result = (0, readFile_1.readLocalFile)(args.filePath);
                            break;
                        }
                        case 'write_local_file': {
                            if (config.permissions?.system?.allow_file_write === false) {
                                result = `[Security Blocked] Runtime Permission Denied: File writing is disabled. Update config.yaml to allow.`;
                                break;
                            }
                            result = (0, writeFile_1.writeLocalFile)(args.filePath, args.content);
                            break;
                        }
                        case 'run_terminal_command': {
                            if (config.permissions?.system?.allow_shell_execution === false) {
                                result = `[Security Blocked] Runtime Permission Denied: Shell execution is disabled. Update config.yaml to allow.`;
                                break;
                            }
                            result = await (0, executeShell_1.runTerminalCommand)(args.command);
                            break;
                        }
                        case 'browse_website': {
                            result = await (0, browseWeb_1.browseWebsite)(args.url);
                            break;
                        }
                        case 'install_external_skill': {
                            result = await (0, installSkill_1.installExternalSkill)(args.url);
                            break;
                        }
                        default: {
                            const externalResult = await pluginManager_1.pluginManager.executeTool(toolName, args);
                            if (externalResult !== null) {
                                result = externalResult;
                            }
                            else {
                                result = `Error: Tool ${toolName} is not implemented.`;
                            }
                            break;
                        }
                    }
                    if (result.includes('[Security Blocked]') || result.startsWith('Error:')) {
                        console.log(picocolors_1.default.red(`[❌ Gagal] Tool ${toolName} mengembalikan error atau diblokir.`));
                    }
                    else {
                        console.log(picocolors_1.default.green(`[✅ Sukses] Tool ${toolName} berhasil dieksekusi.`));
                    }
                }
                catch (toolError) {
                    result = `Error executing ${toolName}: ${toolError.message}`;
                    console.log(picocolors_1.default.red(`[❌ Error Crash] Eksekusi ${toolName} gagal total: ${toolError.message}`));
                }
                exports.logger.addEntry({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: toolName,
                    content: result,
                });
            }
            // Second call to get the final answer after tool execution
            const secondMessages = [
                { role: 'system', content: getSystemPrompt() },
                ...exports.logger.getHistory()
                    .filter(m => !(m.role === 'tool' && !m.tool_call_id))
                    .map(m => {
                    let role = m.role;
                    if (role === 'system')
                        role = 'user';
                    const msg = { role, content: m.content || "" };
                    if (m.name)
                        msg.name = m.name;
                    if (m.tool_call_id)
                        msg.tool_call_id = m.tool_call_id;
                    if (m.tool_calls)
                        msg.tool_calls = m.tool_calls;
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
                tracker_1.Tracker.addTokens(secondResponse.usage.total_tokens, config.llm.provider);
            }
            tracker_1.Tracker.addEvent('llm.final_response', { provider: config.llm.provider });
            const finalContent = secondResponse.choices[0].message.content || "";
            exports.logger.addEntry({ role: 'assistant', content: finalContent });
            return finalContent;
        }
        return responseMessage.content || "No response generated.";
    }
    catch (error) {
        console.error("LLM Error:", error);
        return `Error connecting to AI Provider: ${error.message}`;
    }
}
