# Nyxora Agent 🤖
**Production-Grade Secure AI Execution Framework for Web3 Agents.**

[![Version](https://img.shields.io/badge/version-1.6.3-blue.svg)](https://github.com/perasyudha/Nyxora)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security: Production-Grade](https://img.shields.io/badge/Security-Production--Grade-blue.svg)](#️-advanced-security-threat-model)
[![Execution: Cryptographic Approval](https://img.shields.io/badge/Execution-Cryptographic--Approval-orange.svg)](#️-advanced-security-threat-model)
[![Privacy: Local-Only Keys](https://img.shields.io/badge/Privacy-Local--Only--Keys-success.svg)](#️-advanced-security-threat-model)

Nyxora (v1.6.3) is a **secure, non-custodial runtime infrastructure for autonomous onchain agents** built with a robust Monorepo architecture (Node.js & React). Designed for autonomous workflows with a premium Glassmorphism UI dashboard and strict client-side key isolation. 

It operates under an institutional-grade **Cryptographically Bound Human-in-the-Loop** execution model, ensuring that Remote AIs (LLMs) never have unilateral access to your funds.

---

## 🔥 Key Features

### Advanced Security Architecture
*   **3-Tier IPC Architecture**: Nyxora is split into isolated processes: **Core** (LLM Runtime), **Policy Engine** (Guardrails on port 3001), and **Signer Vault** (Isolated Key Manager on Unix Sockets).
*   **Cryptographically Bound Approval**: Policy changes and transactions requested by the AI are drafted as hashes (`sha256`). Approval via the UI requires a challenge nonce, preventing Man-in-the-Middle (MITM) attacks.
*   **Immutable Policy Guardrails**: Transaction limits (e.g. `max_usd_per_tx`) are strictly enforced by the Policy Engine. The LLM has zero write-access to bypass these rules.
*   **Plugin Sandbox VM**: Execute community-built external skills securely inside an airtight Node.js `vm` chamber with zero access to your file system or terminal processes.

### Core Operations & Web3 Execution
*   **System Automation & Full OS Access**: Instruct the agent to read/write local files, run terminal commands, and browse the web natively.
*   **Anti-Rugpull & Security Scanner**: Nyxora can scan smart contracts via GoPlus Labs to detect Honeypots, Hidden Taxes, and malicious proxy upgrades before you buy.
*   **Automated Limit Orders**: Set natural language rules (e.g., "Sell my PEPE if price drops below $0.001"). Nyxora runs a background cron monitor and executes the swap while you sleep (Auto-Approve Bypass configured safely).
*   **Cross-Chain Hybrid Market Scanner**: Real-time asset tracking combining CoinGecko global data with DexScreener on-chain metrics across Ethereum, Base, Solana, BSC, and more.
*   **PNL & Portfolio Tracking**: The AI scans your wallets and multiplies balances by live DEX prices to give you real-time Net Worth estimations.

### AI & UI Customization
*   **Zero-Click Multi-Session**: Instantly create isolated chat sessions with smart auto-naming triggered by your first prompt, exactly like ChatGPT.
*   **Dynamic Trending Tokens**: Live top 5 crypto assets feed directly injected into the dashboard, completely clickable for instant AI market analysis.
*   **Premium Utility-Centric UI**: A sleek, dark-themed dashboard built for high readability and professional Web3 execution, featuring Pseudo-Generative UI widgets (`<BalanceWidget>`, `<MarketWidget>`, `<SwapWidget>`).
*   **Deep Personalization**: Feed the agent custom rules via `user.md` and define its core persona via `IDENTITY.md`.

---

## 📐 Architecture Workflow

The following diagram illustrates Nyxora's **3-Tier Monorepo Architecture**, showing the isolated communication channels (REST API and Unix Socket).

![Architecture Workflow](https://raw.githubusercontent.com/perasyudha/Nyxora/main/assets/architecture.svg)

*Nyxora separates its duties into 3 independent layers for absolute security:*
1. **🧠 Core (The AI Brain)**: The intelligent assistant that strategizes and plans transactions, but **never** holds your funds.
2. **🛡️ Policy Engine (The Guard)**: The security guard that verifies the Brain's plans. If the AI attempts to send funds exceeding your set limits, this engine automatically blocks it.
3. **🔒 Signer Vault (The Safe)**: The offline vault where your Private Keys are securely locked natively in your OS Keyring (GNOME Keyring / macOS Keychain / Windows Credential Manager). It only signs transactions after they pass all rigorous security checks.

*(Note: Despite the multi-layered security process appearing lengthy, the internal system validation and cryptographic signing occurs in **milliseconds**, ensuring zero latency bottlenecks).*

---

## 🛡️ Advanced Security & Threat Model

To dive deeper into the technical details of our Zero-Knowledge security architecture, please visit the [Nyxora Security Blueprint](https://perasyudha.github.io/Nyxora/).

---

## 🚀 Quick Start & Installation

### Global Installation via NPM (Recommended)
The easiest and fastest way to use Nyxora is to install it globally via NPM. This ensures you get the latest version and can run Nyxora from anywhere on your machine.

```bash
# 1. Install Nyxora globally
npm install -g nyxora@latest

# 2. Run the Interactive Setup Wizard (API Keys, Wallet, Telegram)
nyxora setup

# 3. Start the Nyxora background daemon
nyxora start

# 4. Open the Web Dashboard
nyxora dashboard
```
> **⚠️ IMPORTANT:** Whenever you re-run `nyxora setup` or manually edit the config files, you **must restart the daemon** by running `nyxora restart` for the changes to take effect.

### Local Development (From Source)
If you wish to modify the code or run from source, you can use the Monorepo architecture.

```bash
git clone https://github.com/perasyudha/Nyxora.git
cd Nyxora

# 1. Install Dependencies
npm install

# 2. Build the Dashboard UI
npm run build

# 3. Interactive Setup Wizard (API Keys, Wallet, Telegram)
npm run setup

# 4. Start the Nyxora background daemon
npm start

# 5. Open the Web Dashboard
npm run dashboard
```
> **⚠️ IMPORTANT:** Whenever you re-run `npm run setup` or manually edit the config files, you **must restart the daemon** by running `npm run restart` for the changes to take effect.

---

## 📖 Official Documentation

For complete technical deep-dives into our Cryptographic Architecture, please visit our official VitePress Documentation Site!

> **🔗 [Read the Full Nyxora Documentation Here](https://perasyudha.github.io/Nyxora/)**

*(Includes guides on Secure Wallet Imports, Architecture Blueprints, Troubleshooting, and Custom Skill Development).*

---

**❤️ Support the Project**

Building and maintaining a highly secure, zero-trust architecture takes significant time and resources. If you love what we are building, you can help us keep Nyxora open, secure, and constantly evolving by sending a coffee our way:
- **EVM:** `0x18a30d5db50d287dba669c5672cd71246cc4c4c6`
- **Solana:** `A6tSZZ5wJnTZewx6L5ZHa2Bgv7D2jWyFqwr1bM2AV777`

---
**License:** MIT License
