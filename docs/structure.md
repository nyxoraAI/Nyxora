# 🏗️ Codebase Structure

This document provides a comprehensive map of the Nyxora monorepo, detailing the purpose and responsibility of each directory and core file.

## 1. `packages/` (Core System Modules)
This directory contains all the main engines that power Nyxora:

*   **`packages/core` (The AI Brain):** This is the main brain of Nyxora. The LLM operates here to plan transactions, process Natural Language (NLP) commands, manage memory (Episodic Database), and interact with both Web2 APIs (Google Workspace, OS) and Web3 networks.
    *   `src/web3/plugins/`: Contains the immutable Native Web3 skills (e.g. MarketAnalysis, Swap).
    *   `default_skills/`: Contains the default OS and modular skills that are seeded to the user on first boot.
*   **`packages/ml-engine` (The Cognitive Sidecar):** A local Python FastAPI application responsible for heavy computational tasks. It houses `routers/market.py` for Pandas-based technical analysis, `routers/memory.py` for ChromaDB Semantic RAG, and `routers/cognitive.py` for advanced reasoning strategies.
*   **`packages/policy` (The Policy Engine):** This is the security guardrails layer. Before the core can execute a transaction, the policy engine intercepts it to ensure it does not violate defined limits (e.g., `max_usd_per_tx`), detects anomalous activity, and protects against out-of-bounds execution.
*   **`packages/signer` (The Signer Vault):** A secure vault where Private Keys interact with the OS-Native Keyring. This module is completely isolated from the core and is strictly responsible for cryptographic transaction signing only after policy approval.
*   **`packages/registry-contract`:** Contains the smart contract (`NyxoraAgentRegistry`) deployed to Base Sepolia. This represents the "On-Chain AI Kill-Switch" feature, giving you absolute decentralized control to terminate AI execution directly from the blockchain.
*   **`packages/mcp-server`:** The module for Model Context Protocol (MCP) integration. This allows Nyxora to be safely utilized as a server by external agent clients such as Claude Desktop or Cursor IDE.
*   **`packages/dashboard`:** The React/Vite-based Frontend module. This is the local web interface (featuring a dark-themed, glassmorphism UI) that securely obscures API Keys and allows you to approve pending transactions and monitor your portfolio.


## 2. Core Root Files
*   **`launcher.ts` & `bin/nyxora.mjs`:** The entry points for the CLI. These files launch the background daemon, handle the interactive setup process (`nyxora setup`), and serve the Terminal integration.
*   **`SECURITY.md`:** The documentation detailing Nyxora's cryptography standards and Threat Model mitigation strategies.

## ⚙️ 3. Runtime Configuration Files
These files are not committed to the Git repository. They are dynamically generated at runtime and securely stored in your local data directory (e.g., `~/.nyxora/`):
*   **`~/.nyxora/config/episodic.db`:** The local SQLite database where the Nyx Daemon securely stores user personas, chat history (short-term/long-term memory), and contract address whitelists.
*   **`~/.nyxora/config/policy.yaml`:** The rigid configuration file for the NLP Security Policy.
*   **`~/.nyxora/config/disabled_skills.json`:** A state file generated if you opt to disable Web3 capabilities (Pure Assistant Mode).
*   **`~/.nyxora/skills/`:** The directory where your custom AI-generated or community-downloaded `agentskills.io` modular skills are stored.
*   **`~/.nyxora/config/IDENTITY.md`:** The configuration file where you define the AI's core persona and operating rules.
