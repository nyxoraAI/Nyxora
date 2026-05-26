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
  intro(pc.inverse(' Pengaturan Nyxora CLI '));

  const appDir = getAppDir();
  const config = loadConfig();

  const disclaimer = 
`Nyxora adalah Asisten Web3 yang beroperasi dengan akses penuh atas kendali anda.

Tindakan Pencegahan Kritis:
- Private Key Anda adalah nyawa aset Anda. JANGAN PERNAH menyalin atau membagikan file keystore.json.
- Segala instruksi yang Anda berikan via Telegram atau Dashboard dapat memicu transaksi on-chain.
- Disarankan menggunakan model AI yang cerdas untuk akurasi maksimal.

Dengan menggunakan Nyxora, Anda sepenuhnya memegang kendali atas kunci Anda sendiri.`;

  note(disclaimer, 'Peringatan Keamanan');

  const understand = await confirm({
    message: 'Saya mengerti bahwa keamanan Private Key adalah tanggung jawab saya. Lanjutkan?',
    initialValue: true,
  });

  if (isCancel(understand) || !understand) {
    cancel('Pengaturan dibatalkan.');
    return process.exit(0);
  }

  const existingConfigNote = 
`Workspace: ${appDir}
Model Saat Ini: ${config.llm.model}
Provider: ${config.llm.provider}`;

  note(existingConfigNote, 'Konfigurasi Terdeteksi');

  const action = await select({
    message: 'Apa yang ingin Anda lakukan?',
    options: [
      { value: 'keep', label: 'Pertahankan nilai saat ini' },
      { value: 'update', label: 'Tinjau dan perbarui pengaturan' },
    ],
  });

  if (isCancel(action)) {
    cancel('Pengaturan dibatalkan.');
    return process.exit(0);
  }

  if (action === 'keep') {
    outro(pc.green('Selesai! Konfigurasi tidak diubah. Menjalankan Nyxora...'));
    return;
  }

  // --- WIZARD FORM ---

  // 1. LLM Provider
  const provider = await select({
    message: 'Pilih Mesin AI (Provider):',
    initialValue: config.llm.provider,
    options: [
      { value: 'openai', label: 'OpenAI (Rekomendasi)' },
      { value: 'gemini', label: 'Google Gemini' },
      { value: 'openrouter', label: 'OpenRouter (Banyak Model)' },
      { value: 'ollama', label: 'Ollama (Lokal)' },
    ],
  });
  if (isCancel(provider)) return process.exit(0);

  // 2. Model Name
  const model = await text({
    message: 'Masukkan nama model AI (contoh: gpt-4o, gemini-2.5-flash):',
    initialValue: config.llm.model,
  });
  if (isCancel(model)) return process.exit(0);

  // 3. API Key for LLM (Saved to config.yaml)
  let apiKey = '';
  if (provider !== 'ollama') {
    apiKey = (await password({
      message: `Masukkan API Key untuk ${provider} (Biarkan kosong jika sudah ada):`,
    })) as string;
    if (isCancel(apiKey)) return process.exit(0);
  }

  // 4. Default Chain
  const defaultChain = await select({
    message: 'Pilih Jaringan Utama (Default Chain):',
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
    message: 'Apakah Anda ingin memasang Bot Telegram?',
    initialValue: config.integrations?.telegram?.enabled || false,
  });
  if (isCancel(setupTelegram)) return process.exit(0);

  let telegramToken = '';
  if (setupTelegram) {
    telegramToken = (await password({
      message: 'Masukkan Telegram Bot Token dari @BotFather (Biarkan kosong jika sudah ada):',
    })) as string;
    if (isCancel(telegramToken)) return process.exit(0);
  }

  // 6. Wallet Private Key (keystore.json)
  const privateKey = await password({
    message: 'Masukkan Wallet Private Key (0x...)\n  (Akan dienkripsi AES-256-GCM. Biarkan kosong jika tidak ingin mengubah):',
  });
  if (isCancel(privateKey)) return process.exit(0);

  let masterPassword = '';
  if (privateKey) {
    masterPassword = (await password({
      message: 'Masukkan MASTER PASSWORD untuk mengenkripsi brankas kunci Anda:',
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
        console.log(pc.yellow('File .env lama telah dihapus demi keamanan.'));
      }
    } catch (error) {
      console.error('Gagal menyimpan keystore.json:', error);
    }
  }

  outro(pc.green('✨ Setup Berhasil! Semua konfigurasi telah disimpan dengan aman.'));
}
