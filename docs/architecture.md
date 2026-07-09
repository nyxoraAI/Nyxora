# 🏗️ Technical Architecture

Nyxora operates on a highly secure, modular **Monorepo** architecture designed to strictly separate the intelligence (LLM) from the cryptography (Wallet). 

By isolating concerns across three separate processes, Nyxora ensures that even if the AI is manipulated via advanced Prompt Injections, it remains physically impossible for it to steal funds.

---

## 🏗️ The 6-Tier Hybrid Architecture

```text
+-------------------------------------------------------------+
|                     Nyxora 6-Tier Architecture              |
+-------------------------------------------------------------+

    [ User / External Client ]
               |
               v
+-----------------------------+       +-------------------------+
|     Dashboard (UI)          |       |      MCP Server         |
|        Port 5173            |       |       Port 3001         |
+-----------------------------+       +-------------------------+
               |                                  |
               +---------------+------------------+
                               |
                               v
                    +--------------------+
                    |   Core LLM Runtime | <--- (NLP Parsing, Routing,
                    |      Port 3000     |       Agent Logic)
                    +--------------------+
                      ^                |
       (RAG & Math)   |                |  (Draft Transaction)
                      v                v
+-------------------------+   +-------------------------------+
|       ML Engine         |   |    Policy Engine (Guard)      |
|       Port 8000         |   |  Unix Socket (IPC) / Loopback |
+-------------------------+   +-------------------------------+
                                               |
                                               | (Approved Payload)
                                               v
                              +-------------------------------+
                              |    Signer Vault (Safe)        |
                              |       Unix Socket (IPC)       |
                              +-------------------------------+
                                               |
                                               v
                                      [ Blockchain RPC ]
```

When you launch Nyxora via the background daemon (`nyxora start`), the launcher orchestrates multiple independent microservices that communicate internally across your local system.

### 1. Core Runtime (The Brain) - Port 3000
The Core is the front-facing gateway. It serves the Dashboard UI, connects to the Telegram Bot API, and houses the LLM orchestration logic. 
*   **Role:** Analyzes user intent, reads memory, and builds transaction payloads (unsigned drafts).
*   **Highly Optimized Dependencies:** The Core relies on lightweight, secure dependencies to minimize overhead. It uses `grammy` for robust Telegram bot interactions, `croner` for precise timezone-aware scheduling, `write-excel-file` for secure zero-dependency reporting, and an ultra-fast *Native Fetch REST* implementation for Gemini communication (bypassing `@google/genai`), while retaining official vendor SDKs for OpenAI and Anthropic to ensure maximum stability.
*   **Web3 Component Isolation:** The codebase enforces a strict Separation of Concerns. The `aggregator/` directory acts as the traffic controller for all multi-chain routing logic. For AI-facing tools, Nyxora strictly segregates them: Native Web3 skills reside immutably in `packages/core/src/web3/skills/`, while custom community skills follow the modular `agentskills.io` standard and live safely isolated in `~/.nyxora/skills/`.
*   **Dialectic User Modeling (Honcho):** The Core runs an asynchronous daemon (`honchoDaemon.ts`) that continuously audits your chat history. It extracts your behavioral traits, trading style, and risk tolerance, saving them to `episodic.db`. These traits are then dynamically injected into the reasoning engine (`reasoning.ts`) for real-time persona and tone adaptation.
*   **Autonomous Skill Synthesizing:** Using the `skillExtractor.ts` engine, the Core has the meta-ability to generate new custom skills dynamically based on your natural language instructions. It writes the logic and schema directly into `~/.nyxora/skills/`.
*   **NLP Intelligence ("Context Overrides Defaults"):** The Core is designed to prioritize your explicit natural language commands over the static Dashboard configurations. If your Dashboard is locked to `Base` and `Uniswap V2`, but you chat via Telegram asking to *"Swap on Arbitrum using Li.Fi"*, the Brain dynamically overrides the default fallback variables in real-time, executing the specific intent without permanently altering your Dashboard settings.
*   **Asynchronous Watchdog Agents (Sub-Agents):** Nyxora supports spawning detached background instances for long-running monitoring tasks. When requested (e.g., *"Monitor $ETH and notify me if it drops below $2500"*), the Core invokes a lightweight Sub-Agent that loops asynchronously, leaving your primary session free for other tasks.
*   **Time-Based AI Scheduler (CronManager):** The Core Runtime operates an internal Cron engine (`croner`). It can schedule recurring AI tasks entirely decoupled from the active chat session. When a background task fires, the result is natively pushed directly to your smartphone via the Telegram Gateway API.
*   **Playbooks (Markdown SOPs):** Aside from code-based skills, Nyxora possesses a unique `PlaybookManager` which acts as an SOP (Standard Operating Procedure) interpreter. The LLM natively searches and reads instruction manuals written in plain Markdown (`.md`) from `packages/core/playbooks/` (synced to `~/.nyxora/playbooks/`). This allows the agent to execute complex workflows (like Social Fetch data gathering) by strictly following predefined human-readable steps without requiring hardcoded TypeScript logic.
*   **Limitation:** It does not know your Private Key and cannot sign transactions.

### 2. ML Engine (Cognitive Sidecar) - Port 8000
The ML Engine is a local Python FastAPI backend dedicated to heavy cognitive and analytical tasks.
*   **Role:** Executes Semantic Search (RAG) and performs deterministic market calculations without clogging the Node.js event loop.
*   **Semantic Memory & RAG:** Operates `langchain_huggingface` using the `all-MiniLM-L6-v2` embedding model. It synchronizes the SQLite episodic memory into a fast local ChromaDB vector store, enabling lightning-fast semantic context retrieval.
*   **Market Intelligence Delegation:** Utilizes Pandas (`pandas-ta`) to calculate advanced technical indicators (RSI, MA50) directly from Binance K-Lines, feeding deterministic market scores back to the Core Runtime to prevent LLM hallucinations.
*   **Reinforcement Learning (RL):** Menjalankan PPOAgent untuk mengevaluasi strategi eksekusi token.

### 3. MCP Server (Context Provider) - Port 3001
The MCP (Model Context Protocol) Server acts as an open standard interface between Nyxora and external environments.
*   **Role:** Allows Nyxora to read files, execute terminal commands, and search local knowledge bases natively.
*   **Extensibility:** Developers can plug in any standard MCP tool into Nyxora seamlessly.

### 4. Analytical Dashboard - Port 5173
A beautiful, highly interactive React (Vite) interface tailored for real-time monitoring and conversational execution.
*   **Role:** Visualizes Web3 portfolios, handles real-time WebSockets, and provides the chat interface for interacting with the Core Runtime.
*   **Local First:** Served locally directly from the Nyxora daemon.

### 5. Policy Engine (The Guard) - Unix Socket
The Policy Engine acts as a strict middleware firewall between the Brain and the Vault. It communicates via a combination of Hyper-Optimized IPC (Unix Socket) at `/tmp/nyxora-policy.sock` and local TCP Loopback (`127.0.0.1`) for secure internal routing.
*   **Role:** Receives transaction drafts from the Core. It parses the payload and checks it against immutable rules defined in `policy.yaml` (e.g., maximum daily spend, whitelisted addresses).
*   **Security:** If a transaction exceeds the allowed risk parameters, the Policy Engine drops it immediately.

### 6. Signer Vault (The Safe) - Unix Socket
The Signer Vault is an ultra-secure, isolated process that holds your Private Key in active volatile memory (RAM).
*   **Role:** Receives validated transactions from the Policy Engine, signs them cryptographically, and broadcasts them directly to the Blockchain RPC.
*   **Isolation:** The Signer Vault does not expose any TCP ports. It listens exclusively on an Inter-Process Communication (IPC) Unix Socket (`/tmp/nyxora-signer.sock`). This guarantees that no external network traffic can ever reach the Vault directly.

---

## 🔹 Transaction Lifecycle (End-to-End)

The overarching flow is: **User/Core ➔ Policy Engine (Rules & Approval) ➔ Signer Vault (Key Access & Signing) ➔ Blockchain Network.**

### 1. Transaction Request
Transactions are initially submitted to the Policy Engine via the `/request-tx` endpoint. The payload contains the transaction type (transfer, swap, bridge), target chain, and execution details (destination address, amount).

### 2. Policy Evaluation
When the Policy Engine receives a request, it routes it through one of two paths:
- **Auto-Approve Bypass:** If the transaction is flagged for `autoApprove` (for safe internal operations) and carries a valid HMAC signature matching the `INTERNAL_AUTH_TOKEN`, it bypasses manual approval and flows directly to the Signer Vault.
- **Manual Approval Path:** Otherwise, the system validates the payload against immutable rules in `policy.yaml` (e.g., maximum USD spend limit). If the transaction passes, it enters the `pendingTransactions` queue and awaits cryptographically verified user approval.

### 3. Cryptographic Approval
Pending transactions are approved via the `/approve-tx/:id` endpoint:
- The system demands cryptographic proof consisting of a `nonce` and an `approvalHash`.
- The Policy Engine executes a "Cryptographically Bound Approval" check, matching the provided hash against a strict combination of `txId + nonce + JWT_SECRET`.
- Upon successful verification, the transaction state upgrades to `approved` and is routed to the Signer Vault.

### 4. Execution and Signing (Signer Vault)
The Policy Engine communicates with the Signer Vault over a highly secure local Unix Socket (`/tmp/nyxora-signer.sock`), authorized by a short-lived (1-minute) JWT. Inside the Vault:
- **Private Key Access:** The private key is securely retrieved, prioritizing the OS Native Keyring (via Rust bindings), or falling back to a strictly permissioned local file (`vault.key` chmod 0600).
- **Nonce Management (Mutex Locks):** A robust lock and caching mechanism ensures that concurrent transaction bursts never result in on-chain nonce collisions.
- **Web3 Broadcasting:** Using the `viem` library, the transaction is constructed, signed with the isolated Private Key, and safely broadcasted (`sendTransaction`) to the target blockchain's RPC.

### 5. Response and Finality
Once broadcasted, the Signer Vault returns the Transaction Hash (TxHash) back down the pipeline to the Policy Engine.
Because Web3 transactions can be slow, Nyxora executes them **asynchronously in the background**. This ensures the UI never freezes while waiting for block confirmations. Once finalized, the Policy Engine delivers a strict **English-language** success or failure response back to the User Interface, regardless of the user's primary conversational language.

### 6. Transaction State Persistence
Unlike standard crypto bots that store pending transactions in volatile RAM or scattered JSON files (`.nyxora_withdrawals.json`), Nyxora relies on an enterprise-grade SQLite database (`memory.db`). All pending Web3 executions, approval queues, and cross-chain L2 withdrawals are centrally persisted via `logger.ts`. This provides robust ACID guarantees, ensuring your pending operations survive sudden power losses or daemon restarts completely intact.

---

## 🔹 Background Daemon Lifecycle

Nyxora runs as a true "Local-First" background service, similar to a database daemon or a web server.

### ⚡ Boot Sequence
1. **OS-Native Key Retrieval:** When the `Signer Vault` boots up, it automatically queries the `GNOME Keyring` (Linux), `Keychain` (macOS), or `Credential Manager` (Windows) to retrieve the Private Key securely.
2. **Token Generation:** The launcher generates a random 64-byte `INTERNAL_AUTH_TOKEN` and passes it to the three processes via environment variables. This ensures the processes only trust communication from each other.
3. **Dashboard Access:** The launcher also writes a session token to `~/.nyxora/auth.token`. When you run `nyxora dashboard`, the CLI reads this token to grant you seamless access to the UI without requiring a password.

### ⚡ Graceful Shutdown & Zombie Prevention
When you execute `nyxora stop` or `nyxora restart`, the CLI manager sends a `SIGTERM` signal to the process group leader. 

The orchestrator intercepts this signal and performs a cascading cleanup—terminating the Core, Policy, and Signer children precisely, and automatically clearing any stale Unix Sockets to prevent `EADDRINUSE` zombie lockups. 

**Web3 Promise Tracking:** Additionally, the Gateway API (`server.ts`) utilizes a Promise Tracking engine via `txManager.waitForAll()`. Before terminating the HTTP server, Nyxora intelligently waits up to 10 seconds for any active on-chain Web3 transactions to finish broadcasting. This eradicates the risk of dangling transactions and protects your funds during forced restarts.

### 🚀 Atomic File Operations
Configuration write operations (such as `config.yaml` and Google Credentials in `parser.ts`) are fortified using OS-level atomic renames (`fs.renameSync`). This mechanically eliminates the possibility of 0-byte file corruption during sudden server crashes.

### 💡 System Autostart
Nyxora integrates natively with your OS boot sequence using `nyxora autostart enable`.
Instead of relying on clunky `.bashrc` terminal hacks, the CLI generates native OS hooks (e.g., XDG `.desktop` files on Linux or LaunchAgent `.plist` files on macOS), guaranteeing the AI is awake and monitoring your portfolio the moment your computer turns on.
