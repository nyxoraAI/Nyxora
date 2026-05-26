#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import * as dotenv from 'dotenv';
import open from 'open';
import { getAppDir } from '../config/paths';
import { startServer } from './server';
import { runSetupWizard } from './setup';

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
  const globalEnvPath = path.join(appDir, '.env');
  const globalConfigPath = path.join(appDir, 'config.yaml');
  const globalUserMdPath = path.join(appDir, 'user.md');
  const globalIdentityMdPath = path.join(appDir, 'IDENTITY.md');

  // Copy .env.example to ~/.nyxora/.env if it doesn't exist
  if (!fs.existsSync(globalEnvPath)) {
    isFirstBoot = true;
    const exampleEnvPath = path.resolve(__dirname, '../../../.env.example');
    if (fs.existsSync(exampleEnvPath)) {
      fs.copyFileSync(exampleEnvPath, globalEnvPath);
    } else {
      fs.writeFileSync(globalEnvPath, '# Nyxora Environment Variables\nPRIVATE_KEY=\n');
    }
  }

  // Copy default config.yaml
  if (!fs.existsSync(globalConfigPath)) {
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

  // 3. Load Environment Variables from the determined directory
  dotenv.config({ path: path.join(appDir, '.env') });

  // 4. Start the Express API Server (which also serves the static dashboard and Telegram bot)
  startServer();

  // 5. Open the Dashboard in the default browser
  const PORT = process.env.PORT || 3000;
  setTimeout(() => {
    const url = `http://localhost:${PORT}`;
    console.log(`🌐 Opening Dashboard at ${url}`);
    open(url);
  }, 1500);
}

main().catch(console.error);
