import { intro, outro, confirm, select, text, isCancel, cancel, note, password, spinner, log, multiselect } from '@clack/prompts';
import search from '@inquirer/search';
import pc from 'picocolors';
import fs from 'fs';
import path from 'path';
import { getAppDir, getPath } from '../config/paths';
import { loadConfig, saveConfig, saveApiKeys } from '../config/parser';
import crypto from 'crypto';

function encryptKey(privateKey: string, password: string) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
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
import { generatePrivateKey, privateKeyToAccount, generateMnemonic, mnemonicToAccount, english } from 'viem/accounts';

export async function runSetupWizard() {
  console.clear();

  const logo = `
███╗   ██╗██╗   ██╗██╗  ██╗ ██████╗ ██████╗  █████╗ 
████╗  ██║╚██╗ ██╔╝╚██╗██╔╝██╔═══██╗██╔══██╗██╔══██╗
██╔██╗ ██║ ╚████╔╝  ╚███╔╝ ██║   ██║██████╔╝███████║
██║╚██╗██║  ╚██╔╝   ██╔██╗ ██║   ██║██╔══██╗██╔══██║
██║ ╚████║   ██║   ██╔╝ ██╗╚██████╔╝██║  ██║██║  ██║
╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
  `;

  console.log(pc.cyan(logo));
  intro(pc.inverse(' Nyxora CLI Setup '));

  const appDir = getAppDir();
  const config = loadConfig();

  const disclaimer = 
`Nyxora is a Web3 Assistant that operates with full access under your control.

Critical Precautions:
- Your Private Key is the lifeblood of your assets. NEVER copy or share the keystore.json file.
- Any instructions you provide via Telegram or Dashboard can trigger on-chain transactions.
- It is recommended to use a smart AI model for maximum accuracy.

By using Nyxora, you retain full control over your own keys.`;

  note(disclaimer, 'Security Warning');

  const understand = await confirm({
    message: 'I understand that Private Key security is my responsibility. Continue?',
    initialValue: true,
  });

  if (isCancel(understand) || !understand) {
    cancel('Setup cancelled.');
    return process.exit(0);
  }

  const existingConfigNote = 
`Workspace: ${appDir}
Current Model: ${config.llm.model}
Provider: ${config.llm.provider}`;

  note(existingConfigNote, 'Configuration Detected');

  const action = await select({
    message: 'What would you like to do?',
    options: [
      { value: 'keep', label: 'Keep current values' },
      { value: 'update', label: 'Review and update settings' },
    ],
  });

  if (isCancel(action)) {
    cancel('Setup cancelled.');
    return process.exit(0);
  }

  if (action === 'keep') {
    outro(pc.green('Done! Configuration unchanged. Starting Nyxora...'));
    return;
  }

  // --- WIZARD FORM ---

  // 1. LLM Provider
  const provider = await select({
    message: 'Select AI Engine (Provider):',
    initialValue: config.llm.provider,
    options: [
      { value: 'openai', label: 'OpenAI (Recommended)' },
      { value: 'gemini', label: 'Google Gemini' },
      { value: 'openrouter', label: 'OpenRouter (Many Models)' },
      { value: 'ollama', label: 'Ollama (Local)' },
      { value: 'groq', label: 'Groq (Ultra-fast)' },
      { value: 'mistral', label: 'Mistral AI' },
      { value: 'xai', label: 'xAI (Grok)' },
      { value: 'deepseek', label: 'DeepSeek' },
    ],
  });
  if (isCancel(provider)) return process.exit(0);

  // 2. Model Name
  let modelOptions: { value: string, name: string }[] = [];
  if (provider === 'gemini') {
    modelOptions = [
      { value: 'gemini-3.1-pro', name: 'gemini-3.1-pro' },
      { value: 'gemini-3.1-flash-lite', name: 'gemini-3.1-flash-lite' },
      { value: 'gemini-2.5-flash', name: 'gemini-2.5-flash' },
      { value: 'gemini-2.5-pro', name: 'gemini-2.5-pro' },
      { value: 'gemini-1.5-pro', name: 'gemini-1.5-pro' },
      { value: 'gemini-1.5-flash', name: 'gemini-1.5-flash' },
    ];
  } else if (provider === 'openai') {
    modelOptions = [
      { value: 'gpt-5.5-pro', name: 'gpt-5.5-pro' },
      { value: 'gpt-5.5', name: 'gpt-5.5' },
      { value: 'gpt-5.4-mini', name: 'gpt-5.4-mini' },
      { value: 'gpt-5.4-nano', name: 'gpt-5.4-nano' },
      { value: 'gpt-4o', name: 'gpt-4o' },
      { value: 'o3-mini', name: 'o3-mini' },
    ];
  } else if (provider === 'openrouter') {
    modelOptions = [
      { value: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { value: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
      { value: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
      { value: 'openai/gpt-5.5', name: 'GPT-5.5' },
      { value: 'x-ai/grok-2', name: 'Grok 2' },
      { value: 'mistralai/mistral-large', name: 'Mistral Large' },
    ];
  } else if (provider === 'groq') {
    modelOptions = [
      { value: 'llama-3.3-70b-versatile', name: 'llama-3.3-70b-versatile' },
      { value: 'llama-3.1-8b-instant', name: 'llama-3.1-8b-instant' },
      { value: 'mixtral-8x7b-32768', name: 'mixtral-8x7b-32768' },
    ];
  } else if (provider === 'mistral') {
    modelOptions = [
      { value: 'mistral-large-latest', name: 'mistral-large-latest' },
      { value: 'mistral-small-latest', name: 'mistral-small-latest' },
      { value: 'open-mistral-nemo', name: 'open-mistral-nemo' },
    ];
  } else if (provider === 'xai') {
    modelOptions = [
      { value: 'grok-4.3', name: 'grok-4.3' },
      { value: 'grok-2-latest', name: 'grok-2-latest' },
      { value: 'grok-beta', name: 'grok-beta' },
    ];
  } else if (provider === 'deepseek') {
    modelOptions = [
      { value: 'deepseek-chat', name: 'deepseek-chat (V3)' },
      { value: 'deepseek-reasoner', name: 'deepseek-reasoner (R1)' },
    ];
  } else {
    modelOptions = [
      { value: 'llama3.2', name: 'llama3.2' },
      { value: 'llama3.1', name: 'llama3.1' },
      { value: 'qwen2.5', name: 'qwen2.5' },
      { value: 'phi4', name: 'phi4' },
      { value: 'mistral', name: 'mistral' },
    ];
  }
  
  modelOptions.push({ value: 'custom', name: '[Enter Manual / Custom Model]' });

  let model = '';
  try {
    model = await search({
      message: 'Select AI Model (Type to search):',
      source: async (input: string | undefined) => {
        if (!input) {
          return modelOptions;
        }
        return modelOptions.filter((opt) => 
          opt.name.toLowerCase().includes(input.toLowerCase()) || 
          opt.value.toLowerCase().includes(input.toLowerCase())
        );
      }
    });
  } catch (err: any) {
    if (err.name === 'ExitPromptError') {
      return process.exit(0);
    }
    throw err;
  }
  
  if (model === 'custom') {
    model = (await text({
      message: 'Enter custom model name (e.g., deepseek-coder, llama-3-8b-instruct):',
      initialValue: config.llm.model,
    })) as string;
    if (isCancel(model)) return process.exit(0);
  }

  // 3. API Key for LLM (Saved to config.yaml)
  let apiKey = '';
  if (provider !== 'ollama') {
    apiKey = (await password({
      message: `Enter API Key for ${provider} (Leave empty if already set):`,
    })) as string;
    if (isCancel(apiKey)) return process.exit(0);
  }

  // --- WEB3 SKILLS ---
  const activeWeb3Skills = await multiselect({
    message: '🔹 Select Web3 Skills to enable (Space to toggle, Enter to confirm):',
    options: [
      { value: 'transfer', label: 'Transfer Tokens (Native/ERC20)', hint: 'essential' },
      { value: 'swapToken', label: 'Token Swapping (DEX)', hint: 'essential' },
      { value: 'bridgeToken', label: 'Cross-Chain Bridging' },
      { value: 'customTx', label: 'Execute Custom Transaction (ABI)' },
      { value: 'mintNft', label: 'Mint NFT' },
      { value: 'defiLending', label: 'DeFi Lending (AAVE Supply/Borrow)' },
      { value: 'provideLiquidity', label: 'Provide Liquidity (UniV3)' },
      { value: 'yieldVault', label: 'Yield Vaults (ERC4626 Deposit/Withdraw)' },
      { value: 'revokeApprovals', label: 'Revoke Token Approvals', hint: 'security' },
      { value: 'getBalance', label: 'Check Wallet Balance' },
      { value: 'getMyAddress', label: 'Get Agent Wallet Address' },
      { value: 'checkPortfolio', label: 'Deep Portfolio Analysis' },
      { value: 'getPrice', label: 'Check Token Price' },
      { value: 'marketAnalysis', label: 'Market & Trend Analysis' },
      { value: 'getTxHistory', label: 'Transaction History' },
      { value: 'checkSecurity', label: 'Smart Contract / Token Security Scanner' },
      { value: 'checkAddress', label: 'Address Validation' },
      { value: 'checkRegistryStatus', label: 'Verify Nyxora On-Chain Registry' },
      { value: 'manageCustomTokens', label: 'Manage Custom Tokens List' },
    ],
    required: false,
  }) as string[];
  if (isCancel(activeWeb3Skills)) return process.exit(0);

  let defaultChain: any = config.agent.default_chain || 'ethereum';
  let privateKey = '';

  if (activeWeb3Skills.length > 0) {
    // 4. Default Chain
    defaultChain = await select({
      message: 'Select Default Chain:',
      initialValue: config.agent.default_chain,
      options: [
        { value: 'ethereum', label: 'Ethereum Mainnet' },
        { value: 'bsc', label: 'BSC' },
        { value: 'base', label: 'Base' },
        { value: 'arbitrum', label: 'Arbitrum One' },
        { value: 'optimism', label: 'OP Mainnet' },
        { value: 'polygon', label: 'Polygon (Matic)' },
        { value: 'sepolia', label: 'Sepolia (Testnet)' },
        { value: 'base_sepolia', label: 'Base Sepolia (Testnet)' },
        { value: 'arbitrum_sepolia', label: 'Arbitrum Sepolia (Testnet)' },
        { value: 'optimism_sepolia', label: 'OP Sepolia (Testnet)' },
      ],
    });
    if (isCancel(defaultChain)) return process.exit(0);

    // 6. Wallet Setup
    const walletSetupType = await select({
      message: 'Web3 Wallet Setup:',
      options: [
        { value: 'skip', label: 'Skip for now (No Web3 execution)' },
        { value: 'generate', label: 'Auto-Generate New Wallet' },
        { value: 'manual', label: 'Manual Input (Existing Private Key)' },
      ],
    });
    if (isCancel(walletSetupType)) return process.exit(0);

    if (walletSetupType === 'manual') {
      privateKey = (await password({
        message: 'Enter Wallet Private Key (0x...)\n  (Will be securely locked in your OS Native Keyring Vault):',
      })) as string;
      if (isCancel(privateKey)) return process.exit(0);
    } else if (walletSetupType === 'generate') {
      const seedPhrase = generateMnemonic(english);
      const account = mnemonicToAccount(seedPhrase);
      privateKey = '0x' + Buffer.from(account.getHdKey().privateKey!).toString('hex');
      log.success('New Wallet Generated!');
      log.info(`Address: ${account.address}`);
      log.info(`Private Key: ${privateKey}`);
      log.info(`Seed Phrase (Mnemonic): ${seedPhrase}`);
      log.warn('IMPORTANT: Write down these 12 words (or the Private Key) NOW! This is your ONLY backup. The credentials have been securely injected into your local OS vault.');
    }
  }

  // --- OS SKILLS ---
  const activeOsSkills = await multiselect({
    message: '🔸 Select OS & System Skills to enable (Space to toggle, Enter to confirm):',
    options: [
      { value: 'readFile', label: 'Read Local File' },
      { value: 'writeFile', label: 'Write Local File' },
      { value: 'editFile', label: 'Edit Local File (Patch/Diff)' },
      { value: 'generateExcel', label: 'Generate Excel Reports' },
      { value: 'analyzeDocument', label: 'Analyze Docs (PDF/Word)' },
      { value: 'run_terminal', label: 'Run Terminal Command', hint: '⚠️ UNSAFE' },
      { value: 'installSkill', label: 'Install External Skills (Plugins)' },
      { value: 'gitManager', label: 'Git Operations (Commit/Push/Pull)' },
      { value: 'updateSecurityPolicy', label: 'Update security_policy.md', hint: 'safeguard' },
      { value: 'browseWeb', label: 'Browse & Scrape Webpages' },
      { value: 'searchWeb', label: 'Smart Web Search (Tavily/Brave)', hint: 'Requires API Key' },
      { value: 'googleWorkspace', label: 'Google Workspace (Gmail, Docs, Sheets, Forms)', hint: 'Requires OAuth' },
      { value: 'notionWorkspace', label: 'Notion Integration' },
      { value: 'xManager', label: 'X/Twitter Management' },
      { value: 'audioTranscribe', label: 'Audio Transcription (Whisper)' },
      { value: 'summarizeText', label: 'Summarize Long Text' },
    ],
    required: false,
  }) as string[];
  if (isCancel(activeOsSkills)) return process.exit(0);

  // --- CHANNELS ---
  const activeChannels = await multiselect({
    message: '💬 Select Integration Channels to enable:',
    options: [
      { value: 'telegram', label: 'Telegram Bot', hint: 'Requires Token' },
      { value: 'dashboard', label: 'Local Web Dashboard', hint: 'enabled by default' },
    ],
    initialValues: ['dashboard'],
    required: false,
  }) as string[];
  if (isCancel(activeChannels)) return process.exit(0);

  // --- CONDITIONAL CREDENTIALS ---
  let searchProvider: any = 'skip';
  let searchApiKey = '';
  if (activeOsSkills.includes('searchWeb')) {
    searchProvider = await select({
      message: 'Choose Web Search Provider:',
      options: [
        { value: 'tavily', label: 'Tavily Search (Built for AI - 1000 free/mo)' },
        { value: 'brave', label: 'Brave Search (Privacy focused - 2000 free/mo)' },
      ],
    });
    if (isCancel(searchProvider)) return process.exit(0);

    searchApiKey = (await password({
      message: `Enter API Key for ${searchProvider} (Get it free at ${searchProvider === 'tavily' ? 'tavily.com' : 'search.brave.com'}):`,
    })) as string;
    if (isCancel(searchApiKey)) return process.exit(0);
  }

  const setupTelegram = activeChannels.includes('telegram');
  let telegramToken = '';
  let authorizedChatId = config.integrations?.telegram?.authorized_chat_id;
  if (setupTelegram) {
    telegramToken = (await password({
      message: 'Enter Telegram Bot Token from @BotFather (Leave empty if already set):',
    })) as string;
    if (isCancel(telegramToken)) return process.exit(0);

    if (telegramToken && !authorizedChatId) {
      const s = spinner();
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      
      note(pc.cyan(`1. Open Telegram and search for your Bot.\n2. Send this exact message to your bot:\n\n   /auth ${pin}\n\nWaiting for your message...`), 'Telegram Pairing Required');
      s.start(`Waiting for /auth ${pin} on Telegram...`);

      try {
        const { Telegraf } = require('telegraf');
        const bot = new Telegraf(telegramToken);
        let paired = false;

        bot.command('auth', (ctx: any) => {
          const text = ctx.message.text.split(' ');
          if (text[1] === pin) {
            authorizedChatId = ctx.chat.id;
            paired = true;
            ctx.reply('✅ Bot successfully paired with Nyxora!');
            bot.stop();
          } else {
            ctx.reply('❌ Invalid PIN.');
          }
        });

        bot.launch();

        // Wait until paired
        while (!paired) {
          await new Promise(r => setTimeout(r, 1000));
        }
        s.stop(`Bot successfully paired with Chat ID: ${authorizedChatId}`);
      } catch (err: any) {
        s.stop(`Failed to start bot listener: ${err.message}. You can pair it later.`);
      }
    }
  }



  // --- SAVING ---
  
  // Update Config.yaml
  config.llm.provider = provider as any;
  config.llm.model = model as string;
  config.agent.default_chain = defaultChain as string;
  
  if (!config.skills) config.skills = { web3: [], os: [] } as any;
  config.skills.web3 = activeWeb3Skills;
  config.skills.os = activeOsSkills;

  if (!config.channels) config.channels = { active: [] } as any;
  config.channels.active = activeChannels;

  const newApiKeys: Record<string, string> = {};
  if (apiKey) {
    newApiKeys[`${provider}_key`] = apiKey;
  }

  if (!config.web_search) config.web_search = { provider: 'mesh', enabled: true };
  if (activeOsSkills.includes('searchWeb')) {
    config.web_search.provider = searchProvider as any;
    config.web_search.enabled = true;
    if (searchApiKey) {
      if (searchProvider === 'tavily') newApiKeys.tavily_key = searchApiKey;
      if (searchProvider === 'brave') newApiKeys.brave_key = searchApiKey;
    }
  } else {
    config.web_search.provider = 'mesh';
    config.web_search.enabled = false;
  }

  if (Object.keys(newApiKeys).length > 0) {
    await saveApiKeys(newApiKeys);
  }

  if (!config.integrations) config.integrations = {};
  if (!config.integrations.telegram) config.integrations.telegram = { enabled: false };
  config.integrations.telegram.enabled = setupTelegram as boolean;
  
  if (setupTelegram && telegramToken) {
    config.integrations.telegram.bot_token = telegramToken as string;
  }
  
  if (authorizedChatId) {
    config.integrations.telegram.authorized_chat_id = authorizedChatId;
  }

  saveConfig(config);

  // Sync disabled_skills.json based on user selection
  const allWeb3Skills = [
    'transfer', 'swapToken', 'bridgeToken', 'customTx', 'mintNft',
    'defiLending', 'provideLiquidity', 'yieldVault', 'revokeApprovals',
    'getBalance', 'getMyAddress', 'checkPortfolio', 'getPrice', 'marketAnalysis',
    'getTxHistory', 'checkSecurity', 'checkAddress', 'checkRegistryStatus', 'manageCustomTokens'
  ];
  
  const allOsSkills = [
    'readFile', 'writeFile', 'editFile', 'generateExcel', 'analyzeDocument',
    'run_terminal', 'installSkill', 'gitManager', 'updateSecurityPolicy',
    'browseWeb', 'searchWeb', 'googleWorkspace', 'notionWorkspace', 'xManager',
    'audioTranscribe', 'summarizeText'
  ];

  const disabledSkills: string[] = [];
  allWeb3Skills.forEach(skill => {
    if (!activeWeb3Skills.includes(skill)) disabledSkills.push(skill);
  });
  allOsSkills.forEach(skill => {
    if (!activeOsSkills.includes(skill)) disabledSkills.push(skill);
  });

  // Note: the backend uses 'run_terminal_command', but the UI/wizard used 'run_terminal'
  // I need to map it just in case:
  if (!activeOsSkills.includes('run_terminal')) disabledSkills.push('run_terminal_command');

  fs.writeFileSync(getPath('disabled_skills.json'), JSON.stringify(disabledSkills, null, 2));

  // Save Private Key to OS Keyring or fallback to .env
  if (privateKey) {
    try {
      const { Entry } = require('@napi-rs/keyring');
      const entry = new Entry('nyxora', 'wallet');
      await entry.setPassword(privateKey as string);
      console.log(pc.green('Private key saved securely to OS Keyring.'));
    } catch (error) {
      console.warn(pc.yellow('Failed to save to OS Keyring (Module mismatch or headless server). Falling back to local vault.key'));
      const vaultPath = getPath('vault.key');
      fs.writeFileSync(vaultPath, `PRIVATE_KEY=${privateKey}\n`, { mode: 0o600 });
      console.log(pc.green('Private key saved to ~/.nyxora/vault.key with 0600 permissions.'));
    }
  }

  outro(pc.green('✨ Setup Successful! All configurations have been securely saved.'));
}
