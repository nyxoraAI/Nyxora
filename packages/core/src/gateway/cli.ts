#!/usr/bin/env node

import { initSafeLogger } from '../utils/safeLogger';
initSafeLogger();

import fs from 'fs';
import path from 'path';
import os from 'os';
import open from 'open';
import { getAppDir, getPath } from '../config/paths';
import { startServer } from './server';
import { runSetupWizard } from './setup';
import { password, isCancel, confirm } from '@clack/prompts';
import { getSessionToken } from '../utils/state';
import pc from 'picocolors';
import { saveApiKeys } from '../config/parser';

async function main() {
  // 1. Determine configuration directory
  const appDir = getAppDir();

console.log(`================================`);
console.log(`🤖 Nyxora CLI Agent Booting Up...`);
console.log(`📂 Config Directory: ${appDir}`);
console.log(`================================`);

  // Check for explicit wizard command
  if (process.argv.includes('setup') || process.argv.includes('--wizard')) {
    await runSetupWizard();
    process.exit(0);
  }

  // Check for doctor command
  if (process.argv.includes('doctor')) {
    const { runDoctor } = await import('./doctor');
    await runDoctor();
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
      'brave': 'brave_key',
      'twitter': 'twitter_key',
      'notion': 'notion_key',
      'github': 'github_key'
    };
    
    const mappedKey = keyMap[provider.toLowerCase()] || `${provider.toLowerCase()}_key`;
    
    await saveApiKeys({ [mappedKey]: key });
    console.log(pc.green(`✅ API Key for ${provider} saved successfully.`));
    process.exit(0);
  }

  // Check for wallet command
  if (process.argv.includes('wallet')) {
    if (process.argv.includes('update')) {
      console.log(pc.cyan('\n🔄 Wallet Update Wizard'));
      
      const proceed = await confirm({
        message: pc.bgRed(pc.white(' ⚠️ WARNING ')) + pc.yellow(' This will immediately OVERWRITE your existing wallet in the OS Vault.\nIf you have not backed up your current Private Key, you will lose access to its funds forever.\n\nAre you absolutely sure you want to proceed?'),
      });
      if (isCancel(proceed) || !proceed) process.exit(0);

      const pk = await password({
        message: 'Enter your new Private Key (0x...):',
      });
      if (isCancel(pk)) process.exit(0);
      
      try {
        const { Entry } = await import('@napi-rs/keyring');
        const entry = new Entry('nyxora', 'wallet');
        await entry.setPassword(pk as string);
        console.log(pc.green('✅ Wallet updated securely in OS Native Vault.'));
        console.log(pc.yellow('⚠️ Please restart your Nyxora agent for the new wallet to take effect.\n'));
        // 2. Clear vault.key
        try {
          const vaultPath = path.join(os.homedir(), '.nyxora', 'auth', 'vault.key');
          if (fs.existsSync(vaultPath)) fs.unlinkSync(vaultPath);
        } catch (e) {}
      } catch (e: any) {
        const vaultDir = path.join(os.homedir(), '.nyxora', 'auth');
        if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
        const vaultPath = path.join(vaultDir, 'vault.key');
        fs.writeFileSync(vaultPath, `PRIVATE_KEY=${pk}\n`, { mode: 0o600 });
        console.log(pc.green('✅ Wallet updated securely in fallback vault.key.'));
        console.log(pc.yellow('⚠️ Please restart your Nyxora agent for the new wallet to take effect.\n'));
      }
      process.exit(0);
    } else {
      console.error(pc.red('Usage: nyxora wallet update'));
      process.exit(1);
    }
  }

  // Check for chat command
  if (process.argv.includes('chat')) {
    const { chatInteractive } = await import('./chat');
    await chatInteractive();
    process.exit(0);
  }

  // Check for uninstall command
  if (process.argv.includes('uninstall')) {
    console.log(pc.cyan('\n🗑️  Nyxora Uninstallation Wizard'));
    
    let shouldProceed = process.argv.includes('--force') || process.argv.includes('-y');
    
    if (!shouldProceed) {
      const proceed = await confirm({
        message: pc.bgRed(pc.white(' ⚠️ WARNING ')) + pc.yellow(' This will PERMANENTLY WIPE the AI\'s local memory, securely delete your Private Key and Master Key from the OS Keyring, and remove all configuration.\n\nAre you absolutely sure you want to proceed?'),
      });
      if (isCancel(proceed) || !proceed) process.exit(0);
    }
    
    console.log(pc.gray('\nStarting cleanup process...'));
    
    // 1. Wipe AI Memory
    try {
      const { Logger } = require('../memory/logger');
      const logger = new Logger();
      logger.clear();
      console.log(pc.green('✅ AI memory wiped successfully.'));
    } catch (e: any) {
      console.log(pc.gray('⚠️  Could not clear AI memory (may not exist).'));
    }
    
    // 2. Delete OS Keyring entries
    try {
      const { Entry } = await import('@napi-rs/keyring');
      const walletEntry = new Entry('nyxora', 'wallet');
      try { await walletEntry.deletePassword(); } catch(e) {}
      console.log(pc.green('✅ Wallet key removed from OS Keyring.'));
      
      const masterEntry = new Entry('nyxora', 'config_master');
      try { await masterEntry.deletePassword(); } catch(e) {}
      console.log(pc.green('✅ Master key removed from OS Keyring.'));
    } catch (e: any) {
      console.log(pc.gray('⚠️  Could not access OS Keyring.'));
    }
    
    // 3. Delete ~/.nyxora directory
    try {
      const targetDir = path.join(os.homedir(), '.nyxora');
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        console.log(pc.green('✅ Configuration directory (~/.nyxora) deleted.'));
      }
    } catch (e: any) {
      console.log(pc.red(`❌ Failed to delete ~/.nyxora: ${e.message}`));
    }
    
    console.log(pc.cyan('\n✨ Nyxora data has been completely removed.'));
    console.log(pc.white('To complete the uninstallation, run:'));
    console.log(pc.green('  npm uninstall -g nyxora\n'));
    process.exit(0);
  }

  // 2. Setup boilerplate files since we enforce global mode
  let isFirstBoot = false;
    const globalConfigPath = getPath('config.yaml');
    const globalUserMdPath = getPath('user.md');
    const globalIdentityMdPath = getPath('IDENTITY.md');

    // Copy default config.yaml
    if (!fs.existsSync(globalConfigPath)) {
      isFirstBoot = true;
      let exampleConfigPath = path.resolve(__dirname, '../../../config.yaml'); // Dev
    if (!fs.existsSync(exampleConfigPath)) {
      exampleConfigPath = path.resolve(__dirname, '../../../../../config.yaml'); // Compiled
    }
      if (fs.existsSync(exampleConfigPath)) {
        fs.copyFileSync(exampleConfigPath, globalConfigPath);
      } else {
        fs.writeFileSync(globalConfigPath, 'agent:\n  name: Nyxora-Agent\n  default_chain: base\nllm:\n  provider: openai\n  model: gpt-4\n  temperature: 0.7\nmemory:\n  type: file\n  path: memory.json\n');
      }
    }

  if (!fs.existsSync(globalUserMdPath)) {
    fs.writeFileSync(globalUserMdPath, 'Write custom instructions, special rules, user profiles, or the persona you want for Nyxora AI in this file.\n');
  }

  if (!fs.existsSync(globalIdentityMdPath)) {
    fs.writeFileSync(globalIdentityMdPath, 'You are a Web3 AI assistant named Nyxora.\n');
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
