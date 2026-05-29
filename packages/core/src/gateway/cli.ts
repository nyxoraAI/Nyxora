#!/usr/bin/env node

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

  // 3. Load Private Key into Memory
  const keystorePath = path.join(appDir, 'keystore.json');
  if (fs.existsSync(keystorePath)) {
    const masterPassword = await password({
      message: '🔒 Vault locked! Enter Master Password to access Nyxora:',
    });

    if (isCancel(masterPassword) || !masterPassword) {
      console.log(pc.red('Access denied. Exiting Nyxora.'));
      return process.exit(0);
    }

    try {
      const keystore = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
      const internalToken = process.env.INTERNAL_AUTH_TOKEN;
      let unlocked = false;
      for (let i = 0; i < 5; i++) {
        try {
          const res = await fetch('http://127.0.0.1:3001/unlock', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${internalToken}`
            },
            body: JSON.stringify({ keystore, password: masterPassword })
          });
          
          const data = await res.json();
          if (res.ok && data.success) {
            console.log(pc.green(`✅ Vault successfully unlocked. Agent Address: ${data.address}`));
            unlocked = true;
            break;
          } else {
            console.log(pc.red(`❌ Failed to unlock Vault: ${data.error || 'Unknown error'}`));
            break; // Stop retrying on auth error
          }
        } catch (e: any) {
          if (i === 4) {
            console.log(pc.red(`❌ IPC Connection to Policy failed: ${e.message}`));
          } else {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      
      if (!unlocked) {
        console.log(pc.yellow('⚠️ Proceeding anyway. You can retry unlock via Dashboard later.'));
      }
    } catch (err: any) {
      console.log(pc.red(`❌ Failed to read keystore or connect: ${err.message}`));
    }
  } else {
    console.log(pc.yellow('⚠️ Keystore not found. Web3 features will be disabled unless you run `nyxora setup`.'));
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
