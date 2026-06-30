# Plugin System Overview

Nyxora boasts a highly extensible and robust plugin architecture. Rather than building a monolithic application, the core daemon operates as a lightweight runtime, delegating domain-specific logic to independently managed plugins.

This modularity allows community developers to rapidly integrate new blockchain networks, DeFi protocols, external APIs, and AI models without touching the core routing engine.

## Types of Plugins

The Nyxora ecosystem supports three distinct categories of plugins:

### 1. DeFi Providers & Aggregators
These plugins hook into the `AggregatorRegistry` to provide real-time liquidity and routing paths for token swaps and bridging. They operate inside a strict Zero-Trust sandbox (prevented from accessing private keys).
*Examples: Jupiter Provider, 1inch Provider, LI.FI Provider.*

### 2. Custom Agentic Skills
Skills are discrete, single-purpose functions that empower the AI Agent to perform actions (e.g., fetching a Twitter feed, executing a shell command, or analyzing a smart contract). These are injected directly into the LLM's tool-calling context.
*Examples: Web Search Skill, Github PR Reviewer Skill, Etherscan Reader.*

### 3. Cross-Chain Bridges
Specialized routing plugins designed to facilitate the movement of assets across disparate L1 and L2 networks.
*Examples: Optimism Native Bridge, Arbitrum Orbit Bridge.*

## Autonomous Installation

Nyxora does not use a traditional CLI command (like `npm install` or `nyxora install`) for plugins. Instead, installation is handled completely autonomously by the LLM itself via the `install_defi_provider` skill!

Simply tell your Nyxora Agent in the chat (via Terminal or Telegram):
> *"Hey Nyxora, please install the Jupiter DEX provider from this Github link: https://github.com/nyxoraAI/plugins/blob/main/JupiterProvider.ts"*

Nyxora will dynamically download, scan the code for security violations (enforcing `walletAccess: 'none'`), and install it directly into your `providers/` folder.
