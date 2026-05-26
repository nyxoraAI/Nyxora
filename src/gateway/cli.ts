#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import * as dotenv from 'dotenv';
import open from 'open';
import { getAppDir } from '../config/paths';
import { startServer } from './server';

// 1. Determine configuration directory
const appDir = getAppDir();
const isGlobalMode = appDir !== process.cwd();

console.log(`================================`);
console.log(`🤖 Nyxora CLI Agent Booting Up...`);
console.log(`📂 Config Directory: ${appDir}`);
console.log(`================================`);

// 2. Setup boilerplate files if in global mode and they don't exist
if (isGlobalMode) {
  const globalEnvPath = path.join(appDir, '.env');
  const globalUserMdPath = path.join(appDir, 'user.md');
  const globalIdentityMdPath = path.join(appDir, 'IDENTITY.md');

  // Copy .env.example to ~/.nyxora/.env if it doesn't exist
  if (!fs.existsSync(globalEnvPath)) {
    const exampleEnvPath = path.resolve(__dirname, '../../../.env.example');
    if (fs.existsSync(exampleEnvPath)) {
      fs.copyFileSync(exampleEnvPath, globalEnvPath);
      console.log(`[Setup] Created default .env at ${globalEnvPath}`);
    } else {
      fs.writeFileSync(globalEnvPath, '# Nyxora Environment Variables\nOPENAI_API_KEY=\nGEMINI_API_KEY=\nTELEGRAM_BOT_TOKEN=\n');
    }
  }

  if (!fs.existsSync(globalUserMdPath)) {
    fs.writeFileSync(globalUserMdPath, 'Tuliskan instruksi kustom, aturan khusus, profil pengguna, atau persona yang Anda inginkan untuk Nyxora AI di file ini.\n');
  }

  if (!fs.existsSync(globalIdentityMdPath)) {
    fs.writeFileSync(globalIdentityMdPath, 'Kamu adalah Nyxora, asisten Web3 pintar.\n');
  }
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
