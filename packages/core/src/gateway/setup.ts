import { intro, outro, confirm, select, text, isCancel, cancel, note, password } from '@clack/prompts';
import pc from 'picocolors';
import fs from 'fs';
import path from 'path';
import { getAppDir } from '../config/paths';
import { loadConfig, saveConfig } from '../config/parser';
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
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

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
    ],
  });
  if (isCancel(provider)) return process.exit(0);

  // 2. Model Name
  let modelOptions: { value: string, label: string }[] = [];
  if (provider === 'gemini') {
    modelOptions = [
      { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Fast & Cheap)' },
      { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (Advanced Reasoning)' },
      { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
    ];
  } else if (provider === 'openai') {
    modelOptions = [
      { value: 'gpt-4o', label: 'gpt-4o (Powerful)' },
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini (Fast)' },
      { value: 'o1-preview', label: 'o1-preview (Reasoning)' },
      { value: 'o1-mini', label: 'o1-mini' },
    ];
  } else if (provider === 'openrouter') {
    modelOptions = [
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { value: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
      { value: 'liquid/lfm-40b', label: 'Liquid LFM 40B' },
      { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5' },
    ];
  } else {
    modelOptions = [
      { value: 'llama3', label: 'Llama 3 (8B)' },
      { value: 'qwen2', label: 'Qwen 2' },
      { value: 'phi3', label: 'Phi-3' },
    ];
  }
  
  modelOptions.push({ value: 'custom', label: 'Type manually (Custom Model)' });

  let model = (await select({
    message: 'Select AI Model:',
    options: modelOptions,
  })) as string;
  if (isCancel(model)) return process.exit(0);
  
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

  // 4. Default Chain
  const defaultChain = await select({
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
  if (isCancel(defaultChain)) return process.exit(0);

  // 5. Telegram Bot
  const setupTelegram = await confirm({
    message: 'Do you want to setup the Telegram Bot?',
    initialValue: config.integrations?.telegram?.enabled || false,
  });
  if (isCancel(setupTelegram)) return process.exit(0);

  let telegramToken = '';
  if (setupTelegram) {
    telegramToken = (await password({
      message: 'Enter Telegram Bot Token from @BotFather (Leave empty if already set):',
    })) as string;
    if (isCancel(telegramToken)) return process.exit(0);
  }

  // 6. Wallet Setup
  const walletSetupType = await select({
    message: 'Web3 Wallet Setup:',
    options: [
      { value: 'skip', label: 'Skip for now (No Web3 execution)' },
      { value: 'generate', label: 'Auto-Generate New Wallet (Recommended for testing)' },
      { value: 'manual', label: 'Input Manual Private Key' },
    ],
  });
  if (isCancel(walletSetupType)) return process.exit(0);

  let privateKey = '';
  if (walletSetupType === 'manual') {
    privateKey = (await password({
      message: 'Enter Wallet Private Key (0x...)\n  (Will be AES-256-GCM encrypted. See documentation for import guides):',
    })) as string;
    if (isCancel(privateKey)) return process.exit(0);
  } else if (walletSetupType === 'generate') {
    privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey as any);
    note(`New Wallet Generated!\n\nAddress: ${account.address}\nPrivate Key: ${privateKey}\n\nIMPORTANT: Backup this Private Key NOW! It is securely injected into your local vault, but you will need it to import your wallet elsewhere.`, 'Wallet Created');
  }

  let masterPassword = '';
  if (privateKey) {
    masterPassword = (await password({
      message: 'Enter a strong MASTER PASSWORD to encrypt your key vault:',
    })) as string;
    if (isCancel(masterPassword) || !masterPassword) return process.exit(0);

    const masterPasswordConfirm = (await password({
      message: 'Confirm MASTER PASSWORD:',
    })) as string;
    if (isCancel(masterPasswordConfirm) || masterPassword !== masterPasswordConfirm) {
      console.log(pc.red('❌ Passwords do not match. Setup cancelled.'));
      return process.exit(1);
    }
  }

  // --- SAVING ---
  
  // Update Config.yaml
  config.llm.provider = provider as any;
  config.llm.model = model as string;
  config.agent.default_chain = defaultChain as string;
  
  if (!config.llm.credentials) config.llm.credentials = {};
  if (apiKey) {
    if (provider === 'openai') config.llm.credentials.openai_key = apiKey;
    if (provider === 'gemini') config.llm.credentials.gemini_key = apiKey;
    if (provider === 'openrouter') config.llm.credentials.openrouter_key = apiKey;
  }

  if (!config.integrations) config.integrations = {};
  if (!config.integrations.telegram) config.integrations.telegram = { enabled: false };
  config.integrations.telegram.enabled = setupTelegram as boolean;
  
  if (setupTelegram && telegramToken) {
    config.integrations.telegram.bot_token = telegramToken as string;
  }

  saveConfig(config);

  // Update keystore.json exclusively for Private Key
  if (privateKey && masterPassword) {
    const keystorePath = path.join(appDir, 'keystore.json');
    try {
      const encryptedData = encryptKey(privateKey as string, masterPassword);
      fs.writeFileSync(keystorePath, JSON.stringify(encryptedData, null, 2), 'utf8');
      
      // Cleanup old .env if it existed
      const envPath = path.join(appDir, '.env');
      if (fs.existsSync(envPath)) {
        fs.unlinkSync(envPath);
        console.log(pc.yellow('Legacy .env file has been deleted for security.'));
      }
    } catch (error) {
      console.error('Failed to save keystore.json:', error);
    }
  }

  outro(pc.green('✨ Setup Successful! All configurations have been securely saved.'));
}
