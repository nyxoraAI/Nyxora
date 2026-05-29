"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSetupWizard = runSetupWizard;
const prompts_1 = require("@clack/prompts");
const picocolors_1 = __importDefault(require("picocolors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const paths_1 = require("../config/paths");
const parser_1 = require("../config/parser");
const crypto_1 = __importDefault(require("crypto"));
function encryptKey(privateKey, password) {
    const salt = crypto_1.default.randomBytes(16);
    const key = crypto_1.default.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag,
        encryptedData: encrypted
    };
}
const accounts_1 = require("viem/accounts");
async function runSetupWizard() {
    console.clear();
    const logo = `
███╗   ██╗██╗   ██╗██╗  ██╗ ██████╗ ██████╗  █████╗ 
████╗  ██║╚██╗ ██╔╝╚██╗██╔╝██╔═══██╗██╔══██╗██╔══██╗
██╔██╗ ██║ ╚████╔╝  ╚███╔╝ ██║   ██║██████╔╝███████║
██║╚██╗██║  ╚██╔╝   ██╔██╗ ██║   ██║██╔══██╗██╔══██║
██║ ╚████║   ██║   ██╔╝ ██╗╚██████╔╝██║  ██║██║  ██║
╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
  `;
    console.log(picocolors_1.default.cyan(logo));
    (0, prompts_1.intro)(picocolors_1.default.inverse(' Nyxora CLI Setup '));
    const appDir = (0, paths_1.getAppDir)();
    const config = (0, parser_1.loadConfig)();
    const disclaimer = `Nyxora is a Web3 Assistant that operates with full access under your control.

Critical Precautions:
- Your Private Key is the lifeblood of your assets. NEVER copy or share the keystore.json file.
- Any instructions you provide via Telegram or Dashboard can trigger on-chain transactions.
- It is recommended to use a smart AI model for maximum accuracy.

By using Nyxora, you retain full control over your own keys.`;
    (0, prompts_1.note)(disclaimer, 'Security Warning');
    const understand = await (0, prompts_1.confirm)({
        message: 'I understand that Private Key security is my responsibility. Continue?',
        initialValue: true,
    });
    if ((0, prompts_1.isCancel)(understand) || !understand) {
        (0, prompts_1.cancel)('Setup cancelled.');
        return process.exit(0);
    }
    const existingConfigNote = `Workspace: ${appDir}
Current Model: ${config.llm.model}
Provider: ${config.llm.provider}`;
    (0, prompts_1.note)(existingConfigNote, 'Configuration Detected');
    const action = await (0, prompts_1.select)({
        message: 'What would you like to do?',
        options: [
            { value: 'keep', label: 'Keep current values' },
            { value: 'update', label: 'Review and update settings' },
        ],
    });
    if ((0, prompts_1.isCancel)(action)) {
        (0, prompts_1.cancel)('Setup cancelled.');
        return process.exit(0);
    }
    if (action === 'keep') {
        (0, prompts_1.outro)(picocolors_1.default.green('Done! Configuration unchanged. Starting Nyxora...'));
        return;
    }
    // --- WIZARD FORM ---
    // 1. LLM Provider
    const provider = await (0, prompts_1.select)({
        message: 'Select AI Engine (Provider):',
        initialValue: config.llm.provider,
        options: [
            { value: 'openai', label: 'OpenAI (Recommended)' },
            { value: 'gemini', label: 'Google Gemini' },
            { value: 'openrouter', label: 'OpenRouter (Many Models)' },
            { value: 'ollama', label: 'Ollama (Local)' },
        ],
    });
    if ((0, prompts_1.isCancel)(provider))
        return process.exit(0);
    // 2. Model Name
    let modelOptions = [];
    if (provider === 'gemini') {
        modelOptions = [
            { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Fast & Cheap)' },
            { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (Advanced Reasoning)' },
            { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
        ];
    }
    else if (provider === 'openai') {
        modelOptions = [
            { value: 'gpt-4o', label: 'gpt-4o (Powerful)' },
            { value: 'gpt-4o-mini', label: 'gpt-4o-mini (Fast)' },
            { value: 'o1-preview', label: 'o1-preview (Reasoning)' },
            { value: 'o1-mini', label: 'o1-mini' },
        ];
    }
    else if (provider === 'openrouter') {
        modelOptions = [
            { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
            { value: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
            { value: 'liquid/lfm-40b', label: 'Liquid LFM 40B' },
            { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5' },
        ];
    }
    else {
        modelOptions = [
            { value: 'llama3', label: 'Llama 3 (8B)' },
            { value: 'qwen2', label: 'Qwen 2' },
            { value: 'phi3', label: 'Phi-3' },
        ];
    }
    modelOptions.push({ value: 'custom', label: 'Type manually (Custom Model)' });
    let model = (await (0, prompts_1.select)({
        message: 'Select AI Model:',
        options: modelOptions,
    }));
    if ((0, prompts_1.isCancel)(model))
        return process.exit(0);
    if (model === 'custom') {
        model = (await (0, prompts_1.text)({
            message: 'Enter custom model name (e.g., deepseek-coder, llama-3-8b-instruct):',
            initialValue: config.llm.model,
        }));
        if ((0, prompts_1.isCancel)(model))
            return process.exit(0);
    }
    // 3. API Key for LLM (Saved to config.yaml)
    let apiKey = '';
    if (provider !== 'ollama') {
        apiKey = (await (0, prompts_1.password)({
            message: `Enter API Key for ${provider} (Leave empty if already set):`,
        }));
        if ((0, prompts_1.isCancel)(apiKey))
            return process.exit(0);
    }
    // 4. Default Chain
    const defaultChain = await (0, prompts_1.select)({
        message: 'Select Default Chain:',
        initialValue: config.agent.default_chain,
        options: [
            { value: 'sepolia', label: 'Sepolia (Testnet)' },
            { value: 'base', label: 'Base' },
            { value: 'bsc', label: 'BSC' },
            { value: 'ethereum', label: 'Ethereum Mainnet' },
            { value: 'arbitrum', label: 'Arbitrum' },
            { value: 'optimism', label: 'Optimism' },
        ],
    });
    if ((0, prompts_1.isCancel)(defaultChain))
        return process.exit(0);
    // 5. Telegram Bot
    const setupTelegram = await (0, prompts_1.confirm)({
        message: 'Do you want to setup the Telegram Bot?',
        initialValue: config.integrations?.telegram?.enabled || false,
    });
    if ((0, prompts_1.isCancel)(setupTelegram))
        return process.exit(0);
    let telegramToken = '';
    if (setupTelegram) {
        telegramToken = (await (0, prompts_1.password)({
            message: 'Enter Telegram Bot Token from @BotFather (Leave empty if already set):',
        }));
        if ((0, prompts_1.isCancel)(telegramToken))
            return process.exit(0);
    }
    // 6. Wallet Setup
    const walletSetupType = await (0, prompts_1.select)({
        message: 'Web3 Wallet Setup:',
        options: [
            { value: 'skip', label: 'Skip for now (No Web3 execution)' },
            { value: 'generate', label: 'Auto-Generate New Wallet (Recommended for testing)' },
            { value: 'manual', label: 'Input Manual Private Key' },
        ],
    });
    if ((0, prompts_1.isCancel)(walletSetupType))
        return process.exit(0);
    let privateKey = '';
    if (walletSetupType === 'manual') {
        privateKey = (await (0, prompts_1.password)({
            message: 'Enter Wallet Private Key (0x...)\n  (Will be AES-256-GCM encrypted. See documentation for import guides):',
        }));
        if ((0, prompts_1.isCancel)(privateKey))
            return process.exit(0);
    }
    else if (walletSetupType === 'generate') {
        privateKey = (0, accounts_1.generatePrivateKey)();
        const account = (0, accounts_1.privateKeyToAccount)(privateKey);
        (0, prompts_1.note)(`New Wallet Generated!\nAddress: ${account.address}\n\nIMPORTANT: Backup this address. The Private Key is securely injected into your local vault.`, 'Wallet Created');
    }
    let masterPassword = '';
    if (privateKey) {
        masterPassword = (await (0, prompts_1.password)({
            message: 'Enter a strong MASTER PASSWORD to encrypt your key vault:',
        }));
        if ((0, prompts_1.isCancel)(masterPassword) || !masterPassword)
            return process.exit(0);
        const masterPasswordConfirm = (await (0, prompts_1.password)({
            message: 'Confirm MASTER PASSWORD:',
        }));
        if ((0, prompts_1.isCancel)(masterPasswordConfirm) || masterPassword !== masterPasswordConfirm) {
            console.log(picocolors_1.default.red('❌ Passwords do not match. Setup cancelled.'));
            return process.exit(1);
        }
    }
    // --- SAVING ---
    // Update Config.yaml
    config.llm.provider = provider;
    config.llm.model = model;
    config.agent.default_chain = defaultChain;
    if (!config.llm.credentials)
        config.llm.credentials = {};
    if (apiKey) {
        if (provider === 'openai')
            config.llm.credentials.openai_key = apiKey;
        if (provider === 'gemini')
            config.llm.credentials.gemini_key = apiKey;
        if (provider === 'openrouter')
            config.llm.credentials.openrouter_key = apiKey;
    }
    if (!config.integrations)
        config.integrations = {};
    if (!config.integrations.telegram)
        config.integrations.telegram = { enabled: false };
    config.integrations.telegram.enabled = setupTelegram;
    if (setupTelegram && telegramToken) {
        config.integrations.telegram.bot_token = telegramToken;
    }
    (0, parser_1.saveConfig)(config);
    // Update keystore.json exclusively for Private Key
    if (privateKey && masterPassword) {
        const keystorePath = path_1.default.join(appDir, 'keystore.json');
        try {
            const encryptedData = encryptKey(privateKey, masterPassword);
            fs_1.default.writeFileSync(keystorePath, JSON.stringify(encryptedData, null, 2), 'utf8');
            // Cleanup old .env if it existed
            const envPath = path_1.default.join(appDir, '.env');
            if (fs_1.default.existsSync(envPath)) {
                fs_1.default.unlinkSync(envPath);
                console.log(picocolors_1.default.yellow('Legacy .env file has been deleted for security.'));
            }
        }
        catch (error) {
            console.error('Failed to save keystore.json:', error);
        }
    }
    (0, prompts_1.outro)(picocolors_1.default.green('✨ Setup Successful! All configurations have been securely saved.'));
}
