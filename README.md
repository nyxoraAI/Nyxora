# Nyxora Agent 🤖

Nyxora is a next-generation, autonomous Web3 Agent built on Node.js and React. It operates directly on EVM-compatible blockchains, allowing users to execute on-chain actions simply by chatting with an intelligent LLM. 

With a beautiful, real-time dashboard inspired by modern control centers, Nyxora brings an unparalleled user experience to blockchain automation.

## Features ✨

### 🧠 Core Agent Capabilities
*   **Multi-LLM Support**: Seamlessly switch between Google Gemini, OpenAI, OpenRouter (unlimited models!), or local Ollama models dynamically.
*   **Round-Robin API Rotation**: Add up to 10 API keys via the dashboard. The system will auto-rotate them to prevent rate-limiting and token drain.
*   **Deep Personalization**: Feed the agent custom rules via `user.md` and define its core persona via `IDENTITY.md`.
*   **Multi-Lingual Auto-Sync**: The agent natively detects your language and replies in the exact same language automatically.

### 🛡️ Production-Ready Security (NEW in v1.0.10)
*   **Encrypted Local Keystore**: No more `.env` leaks. Your Private Key is encrypted using `AES-256-GCM` and locked behind a custom **Master Password**.
*   **Human-in-the-Loop Sandboxing**: The agent CANNOT execute transactions on its own. All transactions (Transfers & Swaps) are queued in a **Transaction Manager** and require explicit 1-click Approval from you.
*   **Omnichannel Approvals**: Approve or reject pending transactions directly from the Web Dashboard's UI or via Telegram Inline Keyboard buttons on the go!
*   **Strict API Auth**: The local Express server is protected via ephemeral Session Tokens (`x-nyxora-token`) and Strict CORS, preventing unauthorized local API requests.

### ⛓️ Web3 DeFi Skills (Pro-Trader AI)
*   **Multi-Chain Support**: Operate across Ethereum, Base, BSC, Arbitrum, Optimism, and Sepolia Testnet.
*   **Wallet Generation**: Instruct the AI to generate new EVM wallets on the fly securely (Keys are never saved).
*   **Native Wallet Operations**: Autonomously check balances and transfer native tokens using securely injected wallets.
*   **Advanced Market Intelligence**: Fetch live crypto prices, 24h market movements, FDV, and liquidity via CoinGecko and DexScreener integrations.
*   **Anti-Rugpull & Security Scanner**: Nyxora can scan smart contracts via GoPlus Labs to detect Honeypots, Hidden Taxes, and malicious proxy upgrades before you buy.
*   **PNL & Portfolio Tracking**: The AI scans your wallets and multiplies balances by live DEX prices to give you real-time Net Worth estimations.
*   **DeFi Token Swapping & Bridging**: The agent can autonomously simulate liquidity routes and execute token swaps or cross-chain bridges with gas fee estimations.
*   **Automated Limit Orders (Take-Profit/Cut-Loss)**: Set rules (e.g., "Sell my PEPE if price drops below $0.001"). Nyxora runs a background cron monitor and automatically executes the swap while you sleep without requiring manual approval!

### ⚙️ Web3-Ops & System Automation (NEW in v1.4.1)
*   **NLP Security Policy**: Command Nyxora using natural language to set security boundaries (e.g., *"Never touch partition E" or "Do not install global packages"*). Nyxora autonomously enforces these rules and will pause to ask for your explicit permission if an action violates them.
*   **Full OS Access**: Instruct the agent to read/write local files, run terminal commands, and browse the web natively.
*   **Plugin Manager**: Dynamically load community-built skills. Simply provide a GitHub Gist URL, and Nyxora will download, install, and hot-load the third-party skill directly into its `external_skills` directory.

### 💻 The Interface (Live Canvas)
*   **Premium Glassmorphism UI**: A gorgeous, resizable split-pane interface.
*   **Pseudo-Generative UI**: Instead of raw text, the agent dynamically renders interactive widgets (`<BalanceWidget>`, `<MarketWidget>`, `<SwapWidget>`) onto the "Live Canvas" when executing Web3 skills.
*   **JARVIS Voice Mode**: Completely hands-free! Uses browser Native Text-to-Speech (TTS) to read AI responses and Auto-Listen loops to capture your next voice command without clicking.

### 📱 Telegram Integration
*   Take your agent anywhere! Connect Nyxora to a Telegram Bot to execute trades, check prices, and chat on the go.

## Quick Start 🚀 (Global Install)

Nyxora is now available on NPM! You can install it as a global CLI tool on your operating system.

### 1. Installation
Open your terminal (Command Prompt, PowerShell, or Linux Terminal) and run:
```bash
npm install -g nyxora
```

### 2. Launching Nyxora
No need to navigate to any specific folder! Just type:
```bash
nyxora
```
On first launch, Nyxora will greet you with an **Interactive Setup Wizard**. This CLI wizard will guide you to securely configure your LLM providers, API keys, and Web3 Wallet.

Nyxora will automatically:
1. Initialize a secure vault in your `~/.nyxora/` directory.
2. Store your Wallet Private Key securely in an encrypted `~/.nyxora/keystore.json` locked by your Master Password.
3. Store operational data (API Keys, RPCs) in `~/.nyxora/config.yaml`.
4. Start the local server, generate a secure Session Token, and open the Web Dashboard automatically!

> 💡 **Tip:** You can invoke the setup wizard at any time to update your keys by running `nyxora setup`.

### 3. Configuration
When the dashboard opens, you can modify any operational parameters in the **Settings** tab. The dashboard allows you to type custom model names, switch RPCs, and rotate your API keys effortlessly.

## Local Development (For Contributors) 🏗️

If you want to modify Nyxora's code, build new skills, or contribute:

1. Clone the repo:
   ```bash
   git clone https://github.com/perasyudha/Nyxora.git
   cd Nyxora
   ```
2. Install dependencies:
   ```bash
   npm install
   cd dashboard && npm install && cd ..
   ```
3. Run the development build:
   ```bash
   npm run build && npm run start
   ```

*To deploy your own branch to NPM, bump the version and run `npm run deploy`!*

## Architecture
*   **Backend**: Node.js, Express, Viem (Web3), node-telegram-bot-api, OpenAI API.
*   **Frontend**: React, Vite, Vanilla CSS, Web Speech API (TTS/STT).
*   **Data**: Local `~/.nyxora/config.yaml` and `~/.nyxora/memory.json`.

## License
MIT License
