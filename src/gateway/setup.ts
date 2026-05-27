import { intro, outro, confirm, select, text, isCancel, cancel, note, password } from '@clack/prompts';
import pc from 'picocolors';
import fs from 'fs';
import path from 'path';
import { getAppDir } from '../config/paths';
import { loadConfig, saveConfig } from '../config/parser';
import { encryptKey } from '../utils/crypto';

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
  const model = await text({
    message: 'Enter AI model name (e.g. gpt-4o, gemini-2.5-flash):',
    initialValue: config.llm.model,
  });
  if (isCancel(model)) return process.exit(0);

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

  // 6. Wallet Private Key (keystore.json)
  const privateKey = await password({
    message: 'Enter Wallet Private Key (0x...)\n  (Will be AES-256-GCM encrypted. Leave empty to keep current):',
  });
  if (isCancel(privateKey)) return process.exit(0);

  let masterPassword = '';
  if (privateKey) {
    masterPassword = (await password({
      message: 'Enter MASTER PASSWORD to encrypt your key vault:',
    })) as string;
    if (isCancel(masterPassword) || !masterPassword) return process.exit(0);
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
