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
import { saveApiKeys } from '../config/parser';

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

  // Check for memory clear command
  if (process.argv.includes('clear')) {
    if (process.argv.includes('--force') || process.argv.includes('-y')) {
      const { Logger } = require('../memory/logger');
      const logger = new Logger();
      logger.clear();
      console.log(pc.green('✅ Memory cleared successfully.'));
      process.exit(0);
    } else {
      console.log(pc.yellow('⚠️ Warning: This will wipe all AI memory. Run "nyxora clear --force" to confirm.'));
      process.exit(1);
    }
  }

  // Check for set-key shortcut
  if (process.argv.includes('set-key')) {
    const setKeyIndex = process.argv.indexOf('set-key');
    const provider = process.argv[setKeyIndex + 1];
    const key = process.argv[setKeyIndex + 2];
    
    if (!provider || !key) {
      console.error(pc.red('Usage: nyxora set-key <provider> <api_key>'));
      console.error(pc.gray('Example: nyxora set-key groq gsk_xxx'));
      console.error(pc.gray('Providers: openai, gemini, openrouter, groq, mistral, xai, deepseek, tavily, brave'));
      process.exit(1);
    }
    
    const keyMap: Record<string, string> = {
      'openai': 'openai_key',
      'gemini': 'gemini_key',
      'openrouter': 'openrouter_key',
      'groq': 'groq_key',
      'mistral': 'mistral_key',
      'xai': 'xai_key',
      'deepseek': 'deepseek_key',
      'tavily': 'tavily_key',
      'brave': 'brave_key'
    };
    
    const mappedKey = keyMap[provider.toLowerCase()] || `${provider.toLowerCase()}_key`;
    
    await saveApiKeys({ [mappedKey]: key });
    console.log(pc.green(`✅ API Key for ${provider} saved securely to vault.`));
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
  const token = getSessionToken(); // Initialize token file
  setTimeout(() => {
    console.log(pc.cyan(`\n✨ Dashboard URL: http://localhost:3000/?token=${token}`));
    console.log(pc.gray(`   (Developers: Vite hot-reload available at http://localhost:5173/?token=${token})\n`));
  }, 1500);
}

main().catch(console.error);
