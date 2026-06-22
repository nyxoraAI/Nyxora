# 🌐 The Nyxora Ecosystem

Nyxora is not just an isolated AI agent; it is a **Central Execution Hub** that bridges the gap between Decentralized Finance (DeFi), Artificial Intelligence (AI), and everyday Operating System environments. 

Our zero-trust architecture allows the core brain to securely interface with dozens of external protocols without compromising your private keys. Below is the comprehensive map of the Nyxora Ecosystem.

---

## 🔗 Supported Blockchain Networks
Nyxora natively supports EVM-compatible chains through `viem`. Agents can read data, estimate gas, and execute transactions across:
- **Ethereum (L1):** The primary layer for high-value transactions and ENS resolution.
- **Base (L2):** Coinbase's ultra-fast rollup for low-fee trading and micro-transactions.
- **Polygon (PoS):** Fully integrated for high-throughput DeFi operations.
- **Arbitrum, Optimism, & Base (L2):** Fully compatible via Custom RPC injections, featuring Native OP Stack Bridge integration and Asynchronous L2 Withdrawal Watchers.

---

## 💱 DeFi, Cross-Chain, & Security Integrations
To protect users from malicious contracts and provide the best trading routes, Nyxora is plugged into top-tier Web3 infrastructure:
- **1inch Network & CowSwap:** Deep liquidity aggregation and MEV-protected batch auctions for secure, Zero-Trust execution.
- **0x, OpenOcean & KyberSwap:** Integrated Meta-Aggregators that dynamically detect chains and route deep liquidity without requiring user-side API keys.
- **Uniswap V2 / V3 & PancakeSwap:** Native router integration for autonomous token swaps across Ethereum, Base, and BNB Smart Chain (BSC).
- **Li.Fi, Relay Protocol, & Native OP Bridge:** Advanced cross-chain bridge aggregators. Nyxora autonomously finds the cheapest routes. It also natively supports L1->L2 OP Stack portal deposits and manages L2->L1 7-day challenge periods via background Asynchronous Watchers.
- **GoPlus Security API:** The agent actively queries GoPlus before any purchase to detect honeypots, hidden mint functions, or malicious proxies in smart contracts.
- **CoinGecko & DexScreener API:** Powers the dynamic portfolio engine and market analysis. These tools allow Nyxora to fetch real-time fiat values for tokens, track daily trending lists, and monitor deep on-chain liquidity pools.

---

## 🧠 Supported AI & LLM Engines
Nyxora is fundamentally **Model-Agnostic**. You are not locked into a single provider. The agent can switch its "Brain" on the fly:
- **Google Gemini:** Optimized support for `gemini-1.5-pro` and `gemini-2.5-flash` for high-speed reasoning.
- **Anthropic (Claude):** Natively supported through the Unified LLM Adapter for Claude 3.5 Sonnet and Claude 4.6.
- **OpenAI:** Full support for `gpt-4o` and `o1-preview`.
- **DeepSeek:** Native integration with DeepSeek's API for top-tier open-source coding and reasoning models.
- **Groq & Mistral:** Ultra-fast LPU inference (Groq) and European open-weight models (Mistral).
- **xAI:** Direct access to the Grok language models.
- **OpenRouter:** A gateway to dozens of open-source models (like Llama 3, Claude, Mistral) through a single API key.
- **Ollama (Local AI):** Run the LLM entirely offline on your local hardware for ultimate privacy (zero cloud data transmission).

---

## 🌍 Web2 & Productivity Extensions
Nyxora excels beyond the blockchain, capable of automating your daily Web2 workflows:
- **Google Workspace MVP:** Read and manage your Gmail, summarize Google Docs, or schedule Google Calendar events entirely through conversational AI.
- **Telegram Bot API:** Control your Nyxora agent remotely through a secure, encrypted Telegram Chat interface, complete with inline Push Notification approvals.
- **Tavily / Brave Search:** Advanced deep-research capabilities to fetch real-time news, crypto sentiment, or developer documentation from the live internet.
- **Local OS Shell & Filesystem:** Read `.env` files, analyze logs, and run bash scripts securely guarded by the NLP Policy Engine.

---

## 🔌 Extensibility (MCP)
The ecosystem is exponentially expanding. With active **Model Context Protocol (MCP)** native support, developers can securely inject thousands of standardized third-party tools (like Postgres databases, Slack integration, or Notion APIs) directly into the agent's memory.
