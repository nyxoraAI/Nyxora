#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import open from 'open';
import { getAppDir } from '../config/paths';
import { startServer } from './server';
import { runSetupWizard } from './setup';
import { password, isCancel } from '@clack/prompts';
import { decryptKey, EncryptedKeystore } from '../utils/crypto';
import { setPrivateKey, getSessionToken } from '../utils/state';
import pc from 'picocolors';

async function main() {
  // 1. Determine configuration directory
  const appDir = getAppDir();
  const isGlobalMode = appDir !== process.cwd();

console.log(`================================`);
console.log(`🤖 Nyxora CLI Agent Booting Up...`);
console.log(`📂 Config Directory: ${appDir}`);
console.log(`================================`);

  // Check for explicit wizard command
  if (process.argv.includes('setup') || process.argv.includes('--wizard')) {
    await runSetupWizard();
    process.exit(0);
  }

  // 2. Setup boilerplate files if in global mode and they don't exist
  let isFirstBoot = false;
  if (isGlobalMode) {
  const globalConfigPath = path.join(appDir, 'config.yaml');
  const globalUserMdPath = path.join(appDir, 'user.md');
  const globalIdentityMdPath = path.join(appDir, 'IDENTITY.md');

  // Copy default config.yaml
  if (!fs.existsSync(globalConfigPath)) {
    isFirstBoot = true;
    const exampleConfigPath = path.resolve(__dirname, '../../../config.yaml');
    if (fs.existsSync(exampleConfigPath)) {
      fs.copyFileSync(exampleConfigPath, globalConfigPath);
    } else {
      fs.writeFileSync(globalConfigPath, 'agent:\n  name: Nyxora-Agent\n  default_chain: base\nllm:\n  provider: openai\n  model: gpt-4o-mini\n  temperature: 0.2\n  api_keys: []\nmemory:\n  type: file\n  path: memory.json\n');
    }
  }

  if (!fs.existsSync(globalUserMdPath)) {
    fs.writeFileSync(globalUserMdPath, 'Tuliskan instruksi kustom, aturan khusus, profil pengguna, atau persona yang Anda inginkan untuk Nyxora AI di file ini.\n');
  }

  if (!fs.existsSync(globalIdentityMdPath)) {
    fs.writeFileSync(globalIdentityMdPath, 'Kamu adalah Nyxora, asisten Web3 pintar.\n');
  }
}

  if (isFirstBoot) {
    console.log('[Setup] Instalasi baru terdeteksi. Memulai Setup Wizard...');
    await runSetupWizard();
  }

  // 3. Load Private Key into Memory
  const keystorePath = path.join(appDir, 'keystore.json');
  if (fs.existsSync(keystorePath)) {
    const masterPassword = await password({
      message: '🔒 Brankas terkunci! Masukkan Master Password untuk mengakses Nyxora:',
    });

    if (isCancel(masterPassword) || !masterPassword) {
      console.log(pc.red('Akses ditolak. Keluar dari Nyxora.'));
      return process.exit(0);
    }

    try {
      const keystore: EncryptedKeystore = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
      const privateKey = decryptKey(keystore, masterPassword as string);
      setPrivateKey(privateKey);
      console.log(pc.green('✅ Kunci Privat berhasil didekripsi ke dalam memori.'));
    } catch (error) {
      console.log(pc.red('❌ Master Password salah atau keystore rusak. Keluar dari Nyxora.'));
      return process.exit(1);
    }
  } else {
    console.log(pc.yellow('⚠️ Keystore tidak ditemukan. Fitur Web3 akan dinonaktifkan kecuali Anda menjalankan `nyxora setup`.'));
  }

  // 4. Start the Express API Server (which also serves the static dashboard and Telegram bot)
  startServer();

  // 5. Open the Dashboard in the default browser
  const PORT = process.env.PORT || 3000;
  const token = getSessionToken();
  setTimeout(() => {
    const url = `http://localhost:${PORT}?token=${token}`;
    console.log(`🌐 Opening Dashboard at ${url}`);
    open(url);
  }, 1500);
}

main().catch(console.error);
