# Codebase Structure

This document provides a comprehensive map of the Nyxora monorepo, detailing the purpose and responsibility of each directory and core file.

## 1. `packages/` (Core System Modules)
This directory contains all the main engines that power Nyxora:

*   **`packages/core` (The AI Brain):** This is the main brain of Nyxora. The LLM operates here to plan transactions, process Natural Language (NLP) commands, manage memory (Episodic Database), and interact with both Web2 APIs (Google Workspace, OS) and Web3 networks.
*   **`packages/policy` (The Policy Engine):** This is the security guardrails layer. Before the core can execute a transaction, the policy engine intercepts it to ensure it does not violate defined limits (e.g., `max_usd_per_tx`), detects anomalous activity, and protects against out-of-bounds execution.
*   **`packages/signer` (The Signer Vault):** A secure vault where Private Keys interact with the OS-Native Keyring. This module is completely isolated from the core and is strictly responsible for cryptographic transaction signing only after policy approval.
*   **`packages/registry-contract`:** Contains the smart contract (`NyxoraAgentRegistry`) deployed to Arbitrum. This represents the "On-Chain AI Kill-Switch" feature, giving you absolute decentralized control to terminate AI execution directly from the blockchain.
*   **`packages/mcp-server`:** The module for Model Context Protocol (MCP) integration. This allows Nyxora to be safely utilized as a server by external agent clients such as Claude Desktop or Cursor IDE.
*   **`packages/dashboard`:** The React/Vite-based Frontend module. This is the local web interface (featuring a dark-themed, glassmorphism UI) that securely obscures API Keys and allows you to approve pending transactions and monitor your portfolio.

## 2. `src/external_skills/`
The designated directory for placing additional custom skills or plugins (OS & Web2 automation). Code here runs within a secure Sandbox VM to ensure safety when executed autonomously by the AI.

## 3. Core Root Files
*   **`launcher.ts` & `bin/nyxora.mjs`:** The entry points for the CLI. These files launch the background daemon, handle the interactive setup process (`nyxora setup`), and serve the Terminal integration.
*   **`memory.db`:** The local SQLite database where Nyxora securely stores profiles, chat history (short-term/long-term memory), and contract address whitelists.
*   **`user.md` & `IDENTITY.md`:** The configuration files where you define the AI's persona/identity and set specific custom rules for how the AI should conduct transactions.
*   **`SECURITY.md`:** The documentation detailing Nyxora's cryptography standards and Threat Model mitigation strategies.
