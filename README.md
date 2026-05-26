# OpenWeb Agent 🤖

OpenWeb is a next-generation, autonomous Web3 Agent built on Node.js and React. It operates directly on EVM-compatible blockchains, allowing users to execute on-chain actions simply by chatting with an intelligent LLM. 

With a beautiful, real-time dashboard inspired by modern control centers, OpenWeb brings an unparalleled user experience to blockchain automation.

## Features ✨

*   **Multi-LLM Support**: Seamlessly switch between Google Gemini, OpenAI, or local Ollama models dynamically.
*   **Multi-Chain Support**: Operate across Ethereum, Base, BSC, Arbitrum, Optimism, and Sepolia Testnet.
*   **Autonomous Web3 Skills**: The agent can autonomously decide when to execute blockchain transactions (e.g., checking balances, transferring native tokens) using your securely injected wallet.
*   **Real-time Dashboard**: 
    *   **Live Metrics**: Track LLM configuration, active chain, and wallet status.
    *   **Memory Vault**: Inspect the agent's long-term memory, view hidden tool calls, or wipe the memory clean.
    *   **Live Logs**: Watch the agent's "thoughts" and system events stream directly into the browser.
    *   **Dynamic Settings**: Change the active AI provider, model, or chain on the fly—no backend restarts required!

## Quick Start 🚀

### 1. Installation
Clone the repository and install dependencies for both the backend and the dashboard:

```bash
git clone https://github.com/perasyudha/OpenWeb.git
cd OpenWeb
npm install
cd dashboard && npm install && cd ..
```

### 2. Configuration
Copy the `.env.example` file to `.env` and fill in your private keys.
```bash
cp .env.example .env
```
> **⚠️ WARNING**: NEVER commit your `.env` file! It contains your wallet's private key and API keys.

### 3. Run the Dashboard
OpenWeb runs a unified backend API and a Vite React frontend concurrently.
```bash
npm run build && npm run dashboard
```
This will automatically launch the UI in your default web browser at `http://localhost:5173`.

## Architecture 🏗️
*   **Backend**: Node.js, Express, Viem (Web3), OpenAI API (compatible with Gemini & Ollama).
*   **Frontend**: React, Vite, Tailwind/Vanilla CSS (Glassmorphism UI), Lucide React.
*   **Data**: Local `config.yaml` for settings and `memory.json` for persistent agent conversations.

## License
MIT License
