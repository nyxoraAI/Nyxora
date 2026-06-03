# 🧠 Native Skills (Comprehensive Guide)

Nyxora comes pre-equipped with a robust set of Native Skills built directly into its core reasoning engine (`reasoning.ts`). These skills are fundamentally integrated with the agent's permissions, heavily monitored by the NLP Security Policy, and do not require installing any external NPM plugins.

Native skills are divided into two primary categories: **OS (Operating System) Level Skills** and **Web3 Native Functions**.

---

## 1. Operating System (OS) Level Skills

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

### 🌐 Advanced Information Retrieval
*   **`searchWeb`**
    *   **Description:** Executes a search engine query (Tavily, Brave, or SearXNG) to find real-time information.
    *   **Capabilities:** Features a [Smart Memory Cache](/skills/web-search) (5-minute TTL) to save API quotas, a dynamic `depth` parameter (Level 1 to 3) for Deep Research, and an auto-inject year mechanism to ensure data is always up-to-date.
*   **`browseWeb` (Scraping)**
    *   **Description:** Navigates to a specific URL and scrapes the raw text content of the webpage.
    *   **Capabilities:** Used when the AI finds an interesting link via `searchWeb` and needs to dive deeper into the documentation or article content.

### 🛡️ Security & Expansion
*   **`updateSecurityPolicy`**
    *   **Description:** Allows the AI to programmatically append or modify its own security constraints in `security_policy.md`.
    *   **Capabilities:** If you instruct the agent *"From now on, never touch the src/core directory,"* it will use this skill to permanently remember the rule.
*   **`installSkill`**
    *   **Description:** Dynamically installs external Nyxora community plugins via NPM at runtime.
    *   **Capabilities:** If the AI realizes it lacks the capability to interact with a specific DeFi protocol, it can search for and install the required skill package without requiring a system restart.

---

## 2. Web3 Native Functions

Unlike generic AI assistants, Nyxora was built from the ground up for the blockchain. The core runtime includes a built-in Web3 provider layer, meaning the AI possesses native instincts for cryptocurrency operations.

### 🔐 Wallet & Key Management
*   **Secure Signing:** The AI does not hold your private keys in its memory. It generates a cryptographic payload and requests the [OS-Native Keyring Vault](/security/vault) to sign the transaction. 
*   **Address Awareness:** The AI always knows its own public address (`Agent Address`) and the currently active network (e.g., Ethereum Mainnet, Base, Sepolia).

### 💰 Portfolio & Balance Tracking
*   **Native Token Balances:** The AI can query RPC endpoints to check its exact balance of ETH, MATIC, BNB, etc.
*   **ERC-20 Token Tracking:** By passing the contract address, the AI can check the balance of any specific ERC-20 token in the wallet.
*   **Context:** *"What is my current balance across Ethereum and Base?"*

### 🔄 Asset Transfers, Swaps & Automated Trading
*   **Token Transfers:** The AI can autonomously construct and broadcast transactions to send tokens to a specified address or ENS domain (e.g., `vitalik.eth`).
*   **DEX Swaps (Basic):** The core engine can interface with primary decentralized exchanges (like Uniswap routers) to swap tokens if liquidity exists.
*   **Take Profit & Cut Loss (Limit Orders):** Nyxora features a built-in `LimitOrderManager`. You can instruct the AI to execute trades automatically based on price conditions. For example: *"Buy 1 ETH if the price drops below $2500"* (Cut Loss / Buy Limit) or *"Sell 50% of my PEPE if it goes up 2x"* (Take Profit). The agent monitors prices continuously in the background.
*   **Gas Estimation:** The AI natively calculates required Gas Fees (Gwei) before broadcasting to ensure transactions do not fail out of gas.

### 📊 Market Intelligence & Prioritization (Rule 7)
*   **Prioritized Execution:** According to **Critical Rule 7** in the AI's reasoning engine, whenever a user asks for crypto prices, token contract security, or market analysis, the AI **must** prioritize using dedicated Web3 APIs (e.g., CoinGecko, DexScreener) rather than falling back to a generic web search.
*   **Smart Contract Auditing:** The AI can read a smart contract's ABI and source code (if verified on Etherscan) to detect obvious honeypots or vulnerabilities before interacting with it.

*(Note: For highly specialized DeFi operations—such as complex Yield Farming strategies, Flash Loans, or interacting with novel protocols—the agent utilizes the `installSkill` function to load specialized external plugins into its sandbox).*
