# Nyxora Agent 🤖
**Secure AI execution framework for Web3 agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security: Security-First](https://img.shields.io/badge/Security-Security--First-blue.svg)](#)
[![Execution: Human-in-the-Loop](https://img.shields.io/badge/Execution-Human--in--the--Loop-orange.svg)](#)
[![Privacy: Local-Only Keys](https://img.shields.io/badge/Privacy-Local--Only--Keys-success.svg)](#)

Nyxora is a **secure, non-custodial runtime infrastructure for autonomous onchain agents** built with Node.js and React. Designed for autonomous workflows with a premium Glassmorphism UI dashboard and strict client-side key isolation. It operates under a strict **Human-in-the-Loop** execution model for financial transactions.

---

## 🔥 Key Features

### Advanced Trading, Security & Operations
*   **System Automation & Full OS Access**: Instruct the agent to read/write local files, run terminal commands, and browse the web natively.
*   **NLP Security Policy**: Command Nyxora using natural language to set security boundaries (e.g., *"Never touch partition E"*). Nyxora autonomously enforces these rules.
*   **Dynamic Plugin Sandboxing**: Dynamically load community-built skills with restricted FS/Shell access to prevent supply chain attacks and malicious payloads.
*   **Anti-Rugpull & Security Scanner**: Nyxora can scan smart contracts via GoPlus Labs to detect Honeypots, Hidden Taxes, and malicious proxy upgrades before you buy.
*   **Automated Limit Orders**: Set natural language rules (e.g., "Sell my PEPE if price drops below $0.001"). Nyxora runs a background cron monitor and executes the swap while you sleep.
*   **PNL & Portfolio Tracking**: The AI scans your wallets and multiplies balances by live DEX prices to give you real-time Net Worth estimations.

### Core Features
*   **Multi-LLM Support**: Seamlessly switch between Google Gemini, OpenAI, OpenRouter, or local Ollama models.
*   **Premium Glassmorphism UI**: A gorgeous, resizable split-pane interface with Pseudo-Generative UI widgets (`<BalanceWidget>`, `<MarketWidget>`, `<SwapWidget>`).
*   **Round-Robin API Rotation**: Add up to 10 API keys via the dashboard. The system will auto-rotate them to prevent rate-limiting and token drain.
*   **Deep Personalization**: Feed the agent custom rules via `user.md` and define its core persona via `IDENTITY.md`.

---

## 📐 Architecture Workflow

This diagram shows how user interactions flow through the Nyxora Agent, from chat input to on-chain or OS execution:

![Architecture Workflow](https://raw.githubusercontent.com/perasyudha/Nyxora/main/assets/architecture.png)

---

## 🛡️ Security, Threat Model & Permission Boundary

This agent is designed with a **Zero-Knowledge to LLM** architectural pattern to ensure the highest levels of security for investors and users:

*   **Zero-Knowledge to AI Agent (LLM)**: Remote AI Agents and Large Language Models (LLMs) **never** handle your private keys. The LLM only generates structured JSON tool calls.
*   **Cryptographic Memory Isolation**: Transaction signing occurs strictly client-side within the local Node.js process runtime using `viem`. `~/.nyxora/keystore.json` is encrypted with AES-256-GCM.
*   **Plugin Sandboxing**: Built with future plugin ecosystems in mind. Third-party plugins are explicitly denied unrestricted `fs` (FileSystem) and `shell` access to prevent supply chain attacks and malicious execution.
*   **Human-in-the-Loop**: Write actions (like transfers, swaps, bridges) require manual confirmation from the human operator before broadcasting.

---

## 🚀 Quick Start & Installation

### 1. General Users (CLI Install)
Open your terminal (Command Prompt, PowerShell, or Linux Terminal) and run:
```bash
npm install -g nyxora
nyxora setup
```
The Interactive Setup Wizard will securely generate a local vault, configure your LLM, and offer to Auto-Generate a Web3 Wallet for you.

### 2. Local Development (For Contributors)
If you want to modify Nyxora's code, build new skills, or contribute:
```bash
git clone https://github.com/perasyudha/Nyxora.git
cd Nyxora
npm install
cd dashboard && npm install && cd ..
npm run build && npm run start
```

---

## 📖 Official Documentation

For complete technical deep-dives, please visit our official VitePress Documentation Site!

> **🔗 [Read the Full Nyxora Documentation Here](#)**

*(Includes guides on Secure Wallet Imports, API Key Rotations, Troubleshooting, and Custom Skill Development).*

---
**License:** MIT License
