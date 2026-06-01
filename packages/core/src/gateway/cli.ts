#!/usr/bin/env node

import { initSafeLogger } from '../utils/safeLogger';
initSafeLogger();

import fs from 'fs';
import path from 'path';
import os from 'os';
import open from 'open';
import { getAppDir } from '../config/paths';
import { startServer } from './server';
import { runSetupWizard } from './setup';
import { password, isCancel } from '@clack/prompts';
import { getSessionToken } from '../utils/state';
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
    fs.writeFileSync(globalUserMdPath, 'Write custom instructions, special rules, user profiles, or the persona you want for Nyxora AI in this file.\n');
  }

  if (!fs.existsSync(globalIdentityMdPath)) {
    fs.writeFileSync(globalIdentityMdPath, 'You are a Web3 AI assistant named Nyxora.\n');
  }
}

  if (isFirstBoot) {
    console.log('[Setup] New installation detected. Starting Setup Wizard...');
    await runSetupWizard();
  }

  // 4. Start the Express API Server (which also serves the static dashboard and Telegram bot)
  startServer();
  getSessionToken(); // Initialize token file
  console.log(`🌐 Nyxora API Server running on port ${process.env.PORT || 3000}`);
}

main().catch(console.error);
