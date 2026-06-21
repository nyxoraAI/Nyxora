# 🧠 Native Skills (Comprehensive Guide)

Nyxora comes pre-equipped with a robust set of Native Skills built directly into its core reasoning engine (`reasoning.ts`). These skills are fundamentally integrated with the agent's permissions and heavily monitored by the NLP Security Policy.

Native skills are divided into two primary categories: **Web3 Native Functions** and **OS (Operating System) Level Skills**.

---

## 1. Web3 Native Functions

Unlike generic AI assistants, Nyxora was built from the ground up for the blockchain. The core runtime includes a built-in Web3 provider layer, meaning the AI possesses native instincts for cryptocurrency operations.

### 🔐 Wallet & Key Management
*   **Secure Signing:** The AI does not hold your private keys in its memory. It generates a cryptographic payload and requests the [OS-Native Keyring Vault](/security/vault) to sign the transaction. 
*   **Address Awareness:** The AI always knows its own public address (`Agent Address`) and the currently active network (e.g., Ethereum Mainnet, Base, Sepolia).

### 💰 Portfolio & Balance Tracking
*   **Native Token Balances:** The AI can query RPC endpoints to check its exact balance of ETH, MATIC, BNB, etc.
*   **ERC-20 Token Tracking:** By passing the contract address, the AI can check the balance of any specific ERC-20 token in the wallet.
*   **Context:** *"What is my current balance across Ethereum and Base?"*

### 📜 Deep Transaction History
*   **Unified Multi-Chain History:** The AI queries the unified Etherscan API V2 to fetch your historical Native and ERC-20 transactions over the last N days (e.g., 30 days). A single API Key now supports cross-chain fetching across 60+ Mainnets and Testnets simultaneously.
*   **Graceful API Fallback:** You can configure a single Etherscan API key in the Dashboard for ultra-fast fetching, or leave it blank to automatically fallback to free public endpoints.

### 🔄 Asset Transfers, Swaps & Automated Trading
*   **Token Transfers:** The AI can autonomously construct and broadcast transactions to send tokens to a specified address or ENS domain (e.g., `vitalik.eth`).
*   **DEX Swaps & Anti-MEV Slippage:** The core engine interfaces with a powerful **6-Engine Meta-Aggregator** (1inch, 0x, LI.FI, Relay, OpenOcean, and KyberSwap) to route tokens cross-chain. Nyxora uses an **adaptive 'auto' slippage** by default to leverage dynamic MEV-protection from these aggregators. However, the user retains absolute control to override this dynamically—either globally via the Dashboard Settings or on a per-transaction basis through NLP chat commands (e.g., *"Swap with 3% slippage"*).

*   **Gas Estimation:** The AI natively calculates required Gas Fees (Gwei) before broadcasting to ensure transactions do not fail out of gas.

### 📊 Market Intelligence & Prioritization (Rule 7)
*   **Dual-Routing API Waterfall:** Whenever a user asks for crypto prices, market analysis, or deep dives, the AI **must** prioritize using dedicated Web3 APIs. It uses a dual-routing system: Symbol queries (e.g., $ETH) are routed to CoinGecko and CEX APIs for highly accurate global FDV and liquidity metrics. Contract Address queries (e.g., 0x...) are routed to DexScreener for live on-chain pool data.
*   **Smart Contract Auditing:** The AI can read a smart contract's ABI and source code (if verified on Etherscan) to detect obvious honeypots or vulnerabilities before interacting with it.

### ⏱️ Asynchronous Watchdog & AI Scheduler
*   **Time-Based AI Scheduler (CRON):** Nyxora features a robust internal Cron Engine (`scheduleTask` and `cancelTask`). The AI can autonomously schedule recurring prompts or tasks in the background (e.g., *"Check BTC price every hour and notify me"*). The engine runs detached from the main chat session and pushes clean, formatted analysis reports directly to your Telegram bot.
*   **Background Sub-Agents:** Nyxora can spawn detached background agents (`createMarketWatchAgent`) to continuously monitor market conditions, prices, or liquidity pools.
*   **Event-Driven Triggers:** When a user says *"Monitor $SOL and buy 1 SOL if it hits $120"*, the main session immediately delegates this to a Watchdog. The Watchdog loops in the background until the condition is met, seamlessly executing the trade and notifying the user.

### 🏦 Advanced DeFi Optimization
*   **DeFi Lending Engine (Aave V3):** The AI can autonomously fetch dynamic `Pool` addresses and securely draft `supply` payloads to earn yield on idle assets.
*   **Auto-Compounder Vaults:** Integrates Beefy Finance and Yearn Finance. The AI can seamlessly route idle LP tokens into auto-compounding smart contracts to automatically maximize yield.
*   **DEX LP Manager:** Integrated Uniswap V3 (and PancakeSwap V3 for BSC) liquidity provision with strict human-in-the-loop safety barriers for `tickLower` and `tickUpper` price ranges.
*   **DeFi Security Guard (Revoke):** A critical security skill allowing the AI to construct 0-value `approve()` payloads to instantly revoke "Infinite Approvals" from malicious or vulnerable smart contracts.
*   **Transaction Chaining (Smart Approve):** The AI intelligently reads user allowances prior to execution. It will autonomously draft a precise `approve` payload before supplying Aave or depositing to Beefy, drastically improving UX.


---

## 2. Operating System (OS) Level Skills

These skills allow the AI to interact directly with your local machine, file system, and terminal. They are the backbone of Nyxora's ability to act as an autonomous developer.

### 💻 System Execution
*   **`executeShell`**
    *   **Description:** Allows the AI to spawn a sub-process and execute bash/terminal commands.
    *   **Capabilities:** Compiling code (`npm run build`), managing dependencies (`npm install`), checking system status (`htop`, `docker ps`), and running shell scripts.
    *   **Security:** This is the most heavily guarded skill. The AI will evaluate every command against your [NLP Security Policy](/skills/nlp). Destructive commands (e.g., `rm -rf /`) or unauthorized network requests are strictly blocked.

### 📂 File System Management
*   **`readFile`**
    *   **Description:** Reads the contents of any file within the allowed workspace directories.
    *   **Capabilities:** Used by the AI to debug code, read configuration files (`package.json`, `.env.example`), and understand the context of the project before writing code.
*   **`writeFile`**
    *   **Description:** Writes new content to a file or overwrites an existing one.
    *   **Capabilities:** Creating new React components, scaffolding API endpoints, or updating configuration files. The AI uses this to autonomously build software for you.

### 📊 Advanced Reporting
*   **`generateExcel`**
    *   **Description:** Converts raw JSON data into beautifully formatted `.xlsx` spreadsheet files.
    *   **Capabilities:** Often chained with `getTxHistory` or `checkPortfolio` to autonomously generate 30-day PnL reports, trading logs, or token balance summaries directly to your local file system.

### 🌐 Advanced Information Retrieval
*   **`searchWeb`**
    *   **Description:** Executes a search engine query (Tavily, Brave, or SearXNG) to find real-time information.
    *   **Capabilities:** Features a [Smart Memory Cache](/skills/web-search) (5-minute TTL) to save API quotas, a dynamic `depth` parameter (Level 1 to 3) for Deep Research, and an auto-inject year mechanism to ensure data is always up-to-date.
*   **`browseWeb` (Scraping)**
    *   **Description:** Navigates to a specific URL and scrapes the raw text content of the webpage.
    *   **Capabilities:** Used when the AI finds an interesting link via `searchWeb` and needs to dive deeper into the documentation or article content.

### 🛡️ Security, Identity & Expansion
*   **`updateSecurityPolicy`**
    *   **Description:** Allows the AI to programmatically append or modify its own security constraints in `policy.yaml` (under the `custom_llm_rules` configuration).
    *   **Capabilities:** If you instruct the agent *"From now on, never touch the src/core directory,"* it will use this skill to permanently remember the rule.
*   **`update_identity` & `update_profile`**
    *   **Description:** Nyxora features strict identity isolation. The AI manages its own core persona (`IDENTITY.md`) using `update_identity`, and stores user preferences (`user.md`) using `update_profile`.
    *   **Capabilities:** The AI synchronizes these states not only in its local reasoning memory but also globally updates the UI Dashboard (e.g. updating the Agent Name).
