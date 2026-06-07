# Nyxora Agent <img src="./packages/dashboard/public/favicon.svg" width="36" align="top" />
**Your Personal Web3 Assistant.**


[![MCP Supported](https://img.shields.io/badge/MCP-Supported-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security: Production-Grade](https://img.shields.io/badge/Security-Production--Grade-blue.svg)](#️-advanced-security-threat-model)
[![Execution: Cryptographic Approval](https://img.shields.io/badge/Execution-Cryptographic--Approval-orange.svg)](#️-advanced-security-threat-model)
[![Privacy: Local-Only Keys](https://img.shields.io/badge/Privacy-Local--Only--Keys-success.svg)](#️-advanced-security-threat-model)

Nyxora is a **secure, non-custodial runtime infrastructure for autonomous onchain agents** built with a robust Monorepo architecture (Node.js & React). Designed for autonomous workflows with a premium Utility-Centric dark-themed UI and strict client-side key isolation. 

**Nyxora now natively supports the Model Context Protocol (MCP)**. You can transform your external AI agents (like Claude Desktop and Cursor) into secure Web3 actors that execute swaps and fetch balances using Nyxora's secure signer vault. [View the MCP Integration Guide](https://nyxoraai.github.io/guide/mcp-integration)

It operates under an institutional-grade **Cryptographically Bound Human-in-the-Loop** execution model, ensuring that Remote AIs (LLMs) never have unilateral access to your funds.

---

## 🔥 Key Features

### Advanced Security Architecture
*   **3-Tier IPC Architecture**: Nyxora is split into isolated processes: **Core** (LLM Runtime), **Policy Engine** (Guardrails on port 3001), and **Signer Vault** (Isolated Key Manager on Unix Sockets).
*   **Cryptographically Bound Approval**: Policy changes and transactions requested by the AI are drafted as hashes (`sha256`). Approval via the UI requires a challenge nonce, preventing Man-in-the-Middle (MITM) attacks.
*   **Immutable Policy Guardrails**: Transaction limits (e.g. `max_usd_per_tx`) are strictly enforced by the Policy Engine. The LLM has zero write-access to bypass these rules.
*   **Plugin Sandbox VM**: Execute community-built external skills securely inside an airtight Node.js `vm` chamber with zero access to your file system or terminal processes.
*   **Enterprise-Grade Stability**: Runs on a WAL-enabled SQLite backend with resilient anti-zombie connection timeouts to ensure maximum concurrency without database locks.

### 🌐 Web3 Skills (On-Chain)
*   **Security Scanner**: Nyxora can scan smart contracts via GoPlus Labs to detect Honeypots, Hidden Taxes, and malicious proxy upgrades before you buy.
*   **Anti-MEV Slippage Protection**: Hardened routing engine with dynamic Slippage Tolerance (default 0.5%) for Relay and Li.Fi. You can manually adjust slippage via the UI or dynamically override it using natural language (e.g., "Swap 1 ETH to PEPE with 10% slippage").
*   **Automated Take Profit (TP) & Cut Loss (CL)**: The trader's holy grail. Set natural language rules (e.g., "Sell my PEPE if price drops below $0.001"). Nyxora runs a background cron monitor and executes the swap while you sleep.
*   **Cross-Chain Hybrid Market Scanner**: Real-time asset tracking combining CoinGecko global data with DexScreener on-chain metrics across Ethereum, Base, Solana, BSC, and more.
*   **"Lean Degen" Auto-Whitelist**: Automatically intercepts Contract Addresses (CAs) whenever you check balances or swap tokens, saving them to your localized `user_whitelist.json` for future tracking.
*   **Dynamic Portfolio Engine**: Merges standard tokens, your custom Degen CAs, and CoinGecko's daily trending list into a single hyper-fast Multicall scan to deliver a clean, spam-free PnL portfolio report in under 1 second.

### 💻 OS & Web2 Skills (Off-Chain)
*   **Google Workspace Automation 🚀**: Transform Nyxora into your ultimate personal assistant. The agent can read your latest Gmail inbox, check your Google Calendar, extract text from Google Docs, and even append expense/trading logs directly to your Google Sheets.
*   **System Automation & Full OS Access**: Instruct the agent to read/write local files, run terminal commands, and browse the web natively.
*   **Unstoppable Synergy**: Combine both engines with a single prompt. Example: *"Read the latest presale token email from my Gmail, automatically set a Take Profit limit order on Uniswap, and log the execution result to my Google Sheets."*

### AI & UI Customization
*   **Zero-Click Multi-Session**: Instantly create isolated chat sessions with smart auto-naming triggered by your first prompt, exactly like ChatGPT.
*   **Dynamic Trending Tokens**: Live top 5 crypto assets feed directly injected into the dashboard, completely clickable for instant AI market analysis.
*   **Premium Utility-Centric UI**: A sleek, dark-themed dashboard built for high readability and professional Web3 execution, featuring Pseudo-Generative UI widgets (`<BalanceWidget>`, `<MarketWidget>`, `<SwapWidget>`).
*   **Massive 2026 Model Roster**: Out-of-the-box support for cutting-edge models via Google Gemini, OpenAI, Groq, Mistral, xAI, DeepSeek, OpenRouter, and local Ollama, equipped with a searchable CLI prompt to instantly find your favorite model.
*   **Strict NLP Exactness (Rule 8)**: The AI is rigorously instructed never to hallucinate or guess missing transaction parameters (like destination chains or swap amounts). It halts and requests human clarification, guaranteeing 100% precision.
*   **Context Overrides Defaults (NLP Intelligence)**: The Dashboard configuration (default chain & router) acts only as a safety net. If you issue an explicit command via Telegram (e.g., *"Swap 10 USDC to USDT on Arbitrum using Li.Fi"*), the NLP engine dynamically bypasses the default settings and executes exactly what you asked for, ensuring maximum flexibility.
*   **Deep Personalization**: Feed the agent custom rules via `user.md` and define its core persona via `IDENTITY.md`.

---

## 📐 Architecture Workflow

The following diagram illustrates Nyxora's **3-Tier Monorepo Architecture**, showing the isolated communication channels (REST API and Unix Socket).

![Architecture Workflow](https://raw.githubusercontent.com/perasyudha/Nyxora/main/assets/architecture.svg)

*Nyxora separates its duties into 3 independent layers for absolute security:*
1. **🧠 Core (The AI Brain)**: The intelligent assistant that strategizes and plans transactions, but **never** holds your funds.
2. **🛡️ Policy Engine (The Guard)**: The security guard that verifies the Brain's plans. If the AI attempts to send funds exceeding your set limits, this engine automatically blocks it.
3. **🔒 Signer Vault (The Safe)**: The offline vault where your Private Keys **and highly sensitive 3rd-party tokens (e.g., Google Workspace OAuth)** are securely locked natively in your OS Keyring (GNOME Keyring / macOS Keychain / Windows Credential Manager). It only signs transactions after they pass all rigorous security checks.

*(Note: Despite the multi-layered security process appearing lengthy, the internal system validation and cryptographic signing occurs in **milliseconds**, ensuring zero latency bottlenecks).*

---

## 🛡️ Advanced Security & Threat Model

To dive deeper into the technical details of our Zero-Knowledge security architecture, please visit the [Nyxora Security Blueprint](https://nyxoraai.github.io/).

---

## 🚀 Quick Start & Installation

### Global Installation via NPM (Recommended)
The easiest and fastest way to use Nyxora is to install it globally via NPM. This ensures you get the latest version and can run Nyxora from anywhere on your machine.

The fastest way to install Nyxora is via our automated installation script:

**For Linux & macOS (Bash):**
```bash
curl -fsSL https://nyxoraai.github.io/install.sh | bash
```

**For Windows (PowerShell):**
```powershell
iwr https://nyxoraai.github.io/install.ps1 -useb | iex
```

Alternatively, you can install it manually on any operating system using NPM:

```bash
npm install -g nyxora@latest
```

### 2. Run the Interactive Setup Wizard (API Keys, Wallet, Telegram)
```bash
nyxora setup
```

### 3. Start the Nyxora background daemon
```bash
nyxora start
```

### 4. Open the Web Dashboard
```bash
nyxora dashboard
```

### Utility: Atomically clear the AI's short-term and long-term memory
```bash
nyxora clear --force
```
> **⚠️ IMPORTANT:** Whenever you re-run `nyxora setup` or manually edit the config files, you **must restart the daemon** by running `nyxora restart` for the changes to take effect.

### Local Development (From Source)
If you wish to modify the code or run from source, you can use the Monorepo architecture.

```bash
git clone https://github.com/nyxoraAI/Nyxora.git
cd Nyxora

# 1. Install Dependencies
npm install

# 2. Build the Dashboard UI
npm run build

# 3. Interactive Setup Wizard (API Keys, Wallet, Telegram)
npm run setup

# 4. Start the Application
npm start
```
*(If you are actively developing and modifying the source code, use `npm run dev` to enable hot-reloading for the frontend and backend).*
> **⚠️ IMPORTANT:** Whenever you re-run `npm run setup` or manually edit the config files, you **must restart the dev server** for the changes to take effect.

---

## 📖 Official Documentation

For complete technical deep-dives into our Cryptographic Architecture, please visit our official VitePress Documentation Site!

> **🔗 [Read the Full Nyxora Documentation Here](https://nyxoraai.github.io/)**

*(Includes guides on Secure Wallet Imports, Architecture Blueprints, Troubleshooting, and Custom Skill Development).*

---

**❤️ Support the Project**

Building and maintaining a highly secure, zero-trust architecture takes significant time and resources. If you love what we are building, you can help us keep Nyxora open, secure, and constantly evolving by sending a coffee our way:
- **EVM:** `0x18a30d5db50d287dba669c5672cd71246cc4c4c6`

---
**License:** MIT License
