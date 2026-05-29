#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const open_1 = __importDefault(require("open"));
const paths_1 = require("../config/paths");
const server_1 = require("./server");
const setup_1 = require("./setup");
const prompts_1 = require("@clack/prompts");
const state_1 = require("../utils/state");
const picocolors_1 = __importDefault(require("picocolors"));
async function main() {
    // 1. Determine configuration directory
    const appDir = (0, paths_1.getAppDir)();
    const isGlobalMode = appDir !== process.cwd();
    console.log(`================================`);
    console.log(`🤖 Nyxora CLI Agent Booting Up...`);
    console.log(`📂 Config Directory: ${appDir}`);
    console.log(`================================`);
    // Check for explicit wizard command
    if (process.argv.includes('setup') || process.argv.includes('--wizard')) {
        await (0, setup_1.runSetupWizard)();
        process.exit(0);
    }
    // 2. Setup boilerplate files if in global mode and they don't exist
    let isFirstBoot = false;
    if (isGlobalMode) {
        const globalConfigPath = path_1.default.join(appDir, 'config.yaml');
        const globalUserMdPath = path_1.default.join(appDir, 'user.md');
        const globalIdentityMdPath = path_1.default.join(appDir, 'IDENTITY.md');
        // Copy default config.yaml
        if (!fs_1.default.existsSync(globalConfigPath)) {
            isFirstBoot = true;
            const exampleConfigPath = path_1.default.resolve(__dirname, '../../../config.yaml');
            if (fs_1.default.existsSync(exampleConfigPath)) {
                fs_1.default.copyFileSync(exampleConfigPath, globalConfigPath);
            }
            else {
                fs_1.default.writeFileSync(globalConfigPath, 'agent:\n  name: Nyxora-Agent\n  default_chain: base\nllm:\n  provider: openai\n  model: gpt-4o-mini\n  temperature: 0.2\n  api_keys: []\nmemory:\n  type: file\n  path: memory.json\n');
            }
        }
        if (!fs_1.default.existsSync(globalUserMdPath)) {
            fs_1.default.writeFileSync(globalUserMdPath, 'Write custom instructions, special rules, user profiles, or the persona you want for Nyxora AI in this file.\n');
        }
        if (!fs_1.default.existsSync(globalIdentityMdPath)) {
            fs_1.default.writeFileSync(globalIdentityMdPath, 'You are a Web3 AI assistant named Nyxora.\n');
        }
    }
    if (isFirstBoot) {
        console.log('[Setup] New installation detected. Starting Setup Wizard...');
        await (0, setup_1.runSetupWizard)();
    }
    // 3. Load Private Key into Memory
    const keystorePath = path_1.default.join(appDir, 'keystore.json');
    if (fs_1.default.existsSync(keystorePath)) {
        const masterPassword = await (0, prompts_1.password)({
            message: '🔒 Vault locked! Enter Master Password to access Nyxora:',
        });
        if ((0, prompts_1.isCancel)(masterPassword) || !masterPassword) {
            console.log(picocolors_1.default.red('Access denied. Exiting Nyxora.'));
            return process.exit(0);
        }
        try {
            const keystore = JSON.parse(fs_1.default.readFileSync(keystorePath, 'utf8'));
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
                        console.log(picocolors_1.default.green(`✅ Vault successfully unlocked. Agent Address: ${data.address}`));
                        unlocked = true;
                        break;
                    }
                    else {
                        console.log(picocolors_1.default.red(`❌ Failed to unlock Vault: ${data.error || 'Unknown error'}`));
                        break; // Stop retrying on auth error
                    }
                }
                catch (e) {
                    if (i === 4) {
                        console.log(picocolors_1.default.red(`❌ IPC Connection to Policy failed: ${e.message}`));
                    }
                    else {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }
            if (!unlocked) {
                console.log(picocolors_1.default.yellow('⚠️ Proceeding anyway. You can retry unlock via Dashboard later.'));
            }
        }
        catch (err) {
            console.log(picocolors_1.default.red(`❌ Failed to read keystore or connect: ${err.message}`));
        }
    }
    else {
        console.log(picocolors_1.default.yellow('⚠️ Keystore not found. Web3 features will be disabled unless you run `nyxora setup`.'));
    }
    // 4. Start the Express API Server (which also serves the static dashboard and Telegram bot)
    (0, server_1.startServer)();
    // 5. Open the Dashboard in the default browser
    const PORT = process.env.PORT || 3000;
    const token = (0, state_1.getSessionToken)();
    setTimeout(() => {
        const url = `http://localhost:${PORT}?token=${token}`;
        console.log(`🌐 Opening Dashboard at ${url}`);
        (0, open_1.default)(url);
    }, 1500);
}
main().catch(console.error);
