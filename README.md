# Nyxora Agent 🤖

Nyxora is a next-generation, autonomous Web3 Agent built on Node.js and React. It operates directly on EVM-compatible blockchains, allowing users to execute on-chain actions simply by chatting with an intelligent LLM. 

With a beautiful, real-time dashboard inspired by modern control centers, Nyxora brings an unparalleled user experience to blockchain automation.

## Features ✨

### 🧠 Core Agent Capabilities
*   **Multi-LLM Support**: Seamlessly switch between Google Gemini, OpenAI, or local Ollama models dynamically.
*   **Round-Robin API Rotation**: Add up to 10 API keys via the dashboard. The system will auto-rotate them to prevent rate-limiting and token drain.
*   **Deep Personalization**: Feed the agent custom rules via `user.md` and define its core persona via `IDENTITY.md`.
*   **Multi-Lingual Auto-Sync**: The agent natively detects your language and replies in the exact same language automatically.

### ⛓️ Web3 DeFi Skills
*   **Multi-Chain Support**: Operate across Ethereum, Base, BSC, Arbitrum, Optimism, and Sepolia Testnet.
*   **Native Wallet Operations**: Autonomously check balances and transfer native tokens using securely injected wallets.
*   **Market Intelligence**: Fetch live crypto prices and 24h market movements via CoinGecko integration.
*   **DeFi Token Swapping**: The agent can autonomously simulate liquidity routes and execute token swaps with gas fee estimations.

### 💻 The Interface (Live Canvas)
*   **Premium Glassmorphism UI**: A gorgeous, resizable split-pane interface.
*   **Pseudo-Generative UI**: Instead of raw text, the agent dynamically renders interactive widgets (`<BalanceWidget>`, `<MarketWidget>`, `<SwapWidget>`) onto the "Live Canvas" when executing Web3 skills.
*   **JARVIS Voice Mode**: Completely hands-free! Uses browser Native Text-to-Speech (TTS) to read AI responses and Auto-Listen loops to capture your next voice command without clicking.

### 📱 Telegram Integration
*   Take your agent anywhere! Connect Nyxora to a Telegram Bot to execute trades, check prices, and chat on the go.

## Quick Start 🚀

### 1. Installation
Clone the repository and install dependencies for both the backend and the dashboard:

```bash
git clone https://github.com/perasyudha/Nyxora.git
cd Nyxora
npm install
cd dashboard && npm install && cd ..
```

### 2. Configuration
Copy the `.env.example` file to `.env` and fill in your private keys.
```bash
cp .env.example .env
```
> **⚠️ WARNING**: NEVER commit your `.env` file! It contains your wallet's private key, API keys, and Telegram Bot Token.

### 3. Run the Dashboard & Bot
Nyxora runs a unified backend API, a Telegram Bot listener, and a Vite React frontend concurrently.
```bash
npm run build && npm run dashboard
```
This will automatically launch the UI in your default web browser at `http://localhost:5173`.

## Architecture 🏗️
*   **Backend**: Node.js, Express, Viem (Web3), node-telegram-bot-api, OpenAI API (compatible with Gemini & Ollama).
*   **Frontend**: React, Vite, Tailwind/Vanilla CSS, Web Speech API (TTS/STT).
*   **Data**: Local `config.yaml` for settings and `memory.json` for persistent agent conversations.

## License
MIT License
