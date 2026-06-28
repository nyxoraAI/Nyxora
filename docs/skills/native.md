# 🧠 Skills & Capabilities (Comprehensive Guide)

Nyxora's capabilities are highly modular and securely isolated. With the **Hermes Adaptation**, skills are divided into three strict structural categories:

1. **Native Web3 Plugins:** Hardcoded into `packages/core/src/web3/plugins/` (Immutable).
2. **Default OS/System Skills:** Seeded automatically into `~/.nyxora/skills/` on first boot from `packages/core/default_skills/`.
3. **Custom Modular Skills:** Your own AI-generated or community-downloaded skills following the `agentskills.io` standard, living dynamically in `~/.nyxora/skills/`.

---

## 1. Web3 Native Functions

Unlike generic AI assistants, Nyxora was built from the ground up for the blockchain. The core runtime includes a built-in Web3 provider layer, meaning the AI possesses native instincts for cryptocurrency operations.

> [!NOTE]
> **Pure Assistant Mode:** If you do not wish to use Web3 features, you can opt out during `nyxora setup`. This cleanly disables all Wallet, DEX, and Blockchain functionality, turning Nyxora into a lightweight OS/Coding assistant.

### 🔐 Wallet & Key Management
*   **Secure Signing:** The AI does not hold your private keys in its memory. It generates a cryptographic payload and requests the [OS-Native Keyring Vault](/security/vault) to sign the transaction. 
*   **Address Awareness:** The AI always knows its own public address (`Agent Address`) and the currently active network (e.g., Ethereum Mainnet, Base, Sepolia).

### 💰 Portfolio & Balance Tracking
*   **Native Token Balances:** The AI can query RPC endpoints to check its exact balance of ETH, MATIC, BNB, etc.
*   **ERC-20 Token Tracking:** By passing the contract address, the AI can check the balance of any specific ERC-20 token in the wallet.
*   **Context:** *"What is my current balance across Ethereum and Base?"*

### 📜 Deep Transaction History
*   **Unified Multi-Chain History:** The AI queries the unified Etherscan API V2 to fetch your historical Native and ERC-20 transactions over the last N days (e.g., 30 days). A single API Key now supports cross-chain fetching across 60+ Mainnets and Testnets simultaneously.

### 🔄 Asset Transfers, Swaps & Automated Trading
*   **Token Transfers:** The AI can autonomously construct and broadcast transactions to send tokens to a specified address or ENS domain (e.g., `vitalik.eth`).
*   **DEX Swaps & Anti-MEV Slippage:** The core engine interfaces with a powerful **8-Engine Meta-Aggregator** (1inch, 0x, LI.FI, Relay, OpenOcean, KyberSwap, ArbitrumBridge, and OpBridge) to route tokens cross-chain. Nyxora uses an **adaptive 'auto' slippage** by default to leverage dynamic MEV-protection.

### 📊 Market Intelligence & Prioritization
*   **Dual-Routing API Waterfall:** Whenever a user asks for crypto prices, market analysis, or deep dives, the AI **must** prioritize using dedicated Web3 APIs. It uses a dual-routing system: Symbol queries (e.g., $ETH) are routed to CoinGecko and CEX APIs for highly accurate global FDV and liquidity metrics. Contract Address queries (e.g., 0x...) are routed to DexScreener for live on-chain pool data.
*   **Smart Contract Auditing:** The AI can read a smart contract's ABI and source code (if verified on Etherscan) to detect obvious honeypots or vulnerabilities before interacting with it.

### ⏱️ Asynchronous Watchdog & AI Scheduler
*   **Time-Based AI Scheduler (CRON):** Nyxora features a robust internal Cron Engine. The AI can autonomously schedule recurring prompts or tasks in the background (e.g., *"Check BTC price every hour and notify me"*). The engine runs detached from the main chat session and pushes clean, formatted analysis reports directly to your Telegram bot.

### 🏦 Advanced DeFi Optimization
*   **DeFi Lending Engine (Aave V3):** The AI can autonomously fetch dynamic `Pool` addresses and securely draft `supply` payloads to earn yield on idle assets.
*   **Auto-Compounder Vaults:** Integrates Beefy Finance and Yearn Finance. The AI can seamlessly route idle LP tokens into auto-compounding smart contracts to automatically maximize yield.
*   **Transaction Chaining (Smart Approve):** The AI intelligently reads user allowances prior to execution. It will autonomously draft a precise `approve` payload before supplying Aave or depositing to Beefy, drastically improving UX.

---

## 2. Operating System (OS) Level Skills

These skills are distributed via the `agentskills.io` standard in your `~/.nyxora/skills/` directory. They allow the AI to interact directly with your local machine, file system, and terminal.

### 💻 System Execution
*   **`executeShell`**
    *   **Description:** Allows the AI to spawn a sub-process and execute bash/terminal commands.
    *   **Capabilities:** Compiling code (`npm run build`), managing dependencies (`npm install`), checking system status (`htop`, `docker ps`), and running shell scripts.
    *   **Security:** This is the most heavily guarded skill. Destructive commands (e.g., `rm -rf /`) or unauthorized network requests are strictly blocked by the Policy Engine.

### 📂 File System Management
*   **`readFile` & `writeFile`**
    *   **Description:** Reads or overwrites local files within allowed workspaces.
    *   **Capabilities:** Used by the AI to debug code, read configuration files, and autonomously build software for you.

### 📊 Advanced Reporting
*   **`generateExcel`**
    *   **Description:** Converts raw JSON data into beautifully formatted `.xlsx` spreadsheet files.
    *   **Capabilities:** Often chained with `getTxHistory` or `checkPortfolio` to autonomously generate 30-day PnL reports, trading logs, or token balance summaries directly to your local file system.

### 🌐 Advanced Information Retrieval
*   **`searchWeb` & `browseWeb`**
    *   **Description:** Executes a search engine query and navigates to URLs to scrape raw text content.
    *   **Capabilities:** Features a Smart Memory Cache (5-minute TTL) to save API quotas and a dynamic `depth` parameter for Deep Research.

---

## 3. Autonomous Skill & Persona Engine

### 🧠 Dialectic User Modeling (Honcho Daemon)
The days of manually editing a `user.md` file are over. Nyxora now runs an asynchronous **Honcho Daemon** in the background. It continuously audits your conversational history to infer your trading style, risk tolerance, and tone preferences. These are securely saved to your local `episodic.db` and dynamically injected into the AI's reasoning engine in real-time.

### 🧩 Autonomous Skill Synthesizing
Nyxora possesses the meta-ability to expand its own capabilities via `skillExtractor.ts`.
If you instruct the agent: *"Memorize this workflow as a new skill named 'fetch_airdrop_eligibility'"*, the AI will autonomously write the Node.js execution logic and the `SKILL.md` schema, saving it directly to your `~/.nyxora/skills/` directory. The skill becomes permanently available to you on all future sessions!
