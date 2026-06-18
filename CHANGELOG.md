# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepashangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [26.6.21]
### Features & Enhancements
- **Clean Uninstallation Wizard:** Added the `nyxora uninstall` command. Users can now safely and cleanly remove all traces of Nyxora from their system. This wizard securely clears the AI's SQLite memory database, purges stored credentials from the OS Native Keyring, and completely deletes the `~/.nyxora` configuration directory.
- **Interactive CLI Chat (`nyxora chat`):** Introduced a new terminal-based interactive chat interface. Users who prefer the command line can now converse directly with the Nyxora background daemon using `@clack/prompts` without needing to open the web dashboard. Features graceful background-safe exits.

## [26.6.20]
### Features & Enhancements
- **Unified Portfolio Scanner Redesign:** Completely overhauled the `Portfolio.tsx` Dashboard UI to provide a denser, more data-rich aesthetic. Token balances across all chains are now aggregated, flattened, and sorted globally by total USD value, replacing the old tabbed per-chain layout.
- **Dynamic 24h Percentage Change:** Upgraded the core backend (`server.ts`) to actively fetch and cache 24-hour percentage price changes (`h24`) via the DexScreener API. The frontend now dynamically calculates and displays a live, weighted average portfolio change instead of a hardcoded placeholder.
- **Unified Global Chain Filtering:** Integrated a new custom `<NetworkSelector>` into the Portfolio page that syncs seamlessly with the global top-bar. It natively supports an "All Chains" wildcard option, allowing users to instantly filter the aggregated token list by a specific network without losing the unified cross-chain view.
- **Wallet Address Exposure API:** Deployed a new `/api/wallet` core endpoint, allowing the Dashboard frontend to securely fetch and display the user's primary connected wallet address directly inside the Portfolio scanner header.
- **Dynamic Fiat Currency Support:** Upgraded the AI's `get_price` semantic skill to recognize and accept a dynamic `currency` parameter. The system can now instantly translate and format cryptocurrency prices into any global fiat currency (such as IDR, EUR, JPY) based on the user's natural language request.

### UI/UX & Layout Fixes
- **Full-Width Fluid Dashboard Containers:** Stripped legacy `max-width` hard-limiters (1200px) from the root `overview.css` and all primary sidebar panels (`Overview`, `Portfolio`, `Web3 Skills`, `OS Skills`, `Settings`, `RPC`, `DeFi`). The dashboard now natively spans the full horizontal resolution of any monitor edge-to-edge.
- **Flexbox Overlap Patch:** Patched a responsive layout bug in the Portfolio header where long network names (e.g., "Base Sepolia (Testnet)") would physically overlap and bleed into the "Portfolio Scanner" title. Added proper `flexWrap: 'wrap'` and flexible gap spacing to guarantee clean degradation on smaller viewports.

## [26.6.19]
### Bug Fixes
- **Dashboard Skill Toggle Sync:** Fixed a bug where disabling skills in the `setup` wizard (CLI) did not reflect on the web Dashboard UI. The wizard stored skill names in `camelCase`, but the core AI engine checked for `snake_case` definitions, bypassing the blacklist. A dictionary mapping was added to `setup.ts` to translate names correctly before saving to `disabled_skills.json`.
- **Third-Party LLM Provider Unblocking:** Removed a legacy, hardcoded restriction block in `reasoning.ts` that artificially rejected LLM providers other than OpenAI, Gemini, Ollama, and OpenRouter. Users can now seamlessly connect Groq, xAI (Grok), Mistral, and DeepSeek via the setup wizard, utilizing their native OpenAI SDK compatibility.
- **Google Workspace OAuth Callback Routing:** Fixed a critical bug in the core `server.ts` global authentication middleware where Express.js path mounting behavior implicitly stripped the `/api` prefix from `req.path`. This caused the Google OAuth callback whitelist exception to fail, resulting in an `Unauthorized: Invalid or missing token` error during dashboard login. The middleware now correctly utilizes `req.originalUrl` for accurate bypass verification.


## [26.6.18]
### Bug Fixes & Build Pipeline
- **NPM Publish Recompilation Fix:** Fixed a critical bug in the NPM `prepare` hook where `npm publish` would skip compiling the core backend TypeScript files. This caused versions `v26.6.16` and `v26.6.17` to inadvertently ship with stale, uncompiled JavaScript `dist/` artifacts. The root `tsc` build step is now explicitly injected into the pre-publish hook to ensure the CLI uses the latest codebase.

## [26.6.17]
### Bug Fixes
- **CLI Setup API Key Overwrite Bug:** Fixed a race condition during `nyxora setup` where newly entered LLM API keys were successfully written to the config file but instantly overwritten by a stale in-memory config save sequence.
- **Removed Zombie `installSkill` CLI Option:** Removed the legacy `installSkill` selection option from the CLI setup wizard to correctly align with the new fully-native, sandbox-free architecture (introduced in v26.6.15).

## [26.6.16]
### Bug Fixes & Stability
- **Global `nyxora start` `ENOENT` Crash Fix:** Resolved a critical bug where launching the daemon on a completely fresh install (or after deleting `~/.nyxora`) would instantly crash due to missing nested log and auth directories. The CLI now gracefully auto-creates all deeply nested required structures before attempting to access them.
- **Node.js ESM Compilation Crash (`launcher.ts`):** Stripped out legacy `import.meta.url` syntax in favor of bulletproof CommonJS `__filename` globals. This permanently eliminates the fatal `exports is not defined` parsing crash on newer Node.js versions running compiled production builds.
- **`nyxora unlock` Missing Dependency Panic:** Refactored the dashboard unlock CLI command to utilize native Node.js 18+ `fetch()` APIs, completely removing the hazardous dynamic import to `node-fetch` (which was missing from NPM `dependencies`).
- **NPM Monorepo Resolution Fix:** Stripped the hardcoded `.ts` extension from `safeLogger` imports to prevent `MODULE_NOT_FOUND` errors on compiled production artifacts.
- **`mcp-server` Publishing:** Wired the `mcp-server` into the root compilation step and included its `dist/` artifacts in the `files` array, ensuring the Universal Bridge is fully operational out-of-the-box for NPM installations.

## [26.6.15]
### Security & Architecture
- **Policy Engine Hard-coded Firewall**: Extracted security constraints (`whitelist_only`, `max_usd_per_tx`, `require_approval`) from `config.yaml` and implemented a fully decoupled backend `policy.yaml` evaluation engine running on a secure local port (3001). This solidifies the Zero-Trust Architecture by guaranteeing rules are enforced prior to cryptographic signing.
- **Unified NLP Semantic Rules**: Migrated `security_policy.md` directly into the `policy.yaml` state (`custom_llm_rules`). AI native skills (`updateSecurityPolicy`) now dynamically append human-language constraints to the centralized policy module, providing a single source of truth for both hard-coded and semantic safeguards.

### UI/UX Enhancements
- **Policy Engine Configuration Panel**: Added a dedicated "Policy Engine (Hard-coded Firewall)" module to the Dashboard Settings page. Users can now easily toggle transaction approvals, strict whitelists, and input custom semantic NLP rules directly from the GUI.
- **Pristine Local Development Logs**: Injected `NODE_NO_WARNINGS=1` environment variables into the core `launcher.ts` monorepo runner. This entirely suppresses noisy `MODULE_TYPELESS_PACKAGE_JSON` CommonJS/ESM reparsing warnings during `npm run dev`, providing a flawless, 100% clean boot log for presentation and development purposes.
- **Internal Version Synchronization**: Synced all sub-packages (`core`, `signer`, `policy`, `mcp-server`) explicitly to `v26.6.15` for consistent NPM publishing.

### Bug Fixes
- **Rapid Graceful Shutdown**: Refactored the core gateway server shutdown sequence to aggressively call `server.closeAllConnections()`. This eliminates the 10-second hang caused by persistent UI polling / SSE connections when stopping the daemon via `CTRL+C`.
- **Market Analysis Cascade Architecture**: Rewired the AI `analyzeMarket` capability in `reasoning.ts` to correctly route through the advanced `analyzeMarketEngine`. This strictly enforces the 3-Tier Cascading Fallback logic (CoinMarketCap  CoinGecko  DexScreener), maximizing market data resilience against API rate-limits.

## [26.6.14]
### Security & Privacy
- **Isolated Private RPC Vault**: Extracted `web3.rpc_urls` from the main `config.yaml` and moved them into a highly isolated `~/.nyxora/config/rpc_key.yaml` file. This guarantees zero risk of leaking Premium Node Endpoints (Alchemy, Infura) when sharing config files or prompts.
- **Auto-Migration Engine**: Implemented a background migration routine (`parser.ts`) that automatically detects legacy RPC setups and seamlessly extracts, transfers, and wipes them from `config.yaml` during the next daemon boot without data loss.
- **Frontend Key Masking**: Upgraded the new "RPC Configuration" UI to strictly use `type="password"`, ensuring sensitive API keys are never visible in plaintext during screen-sharing or recordings.

### UI/UX Enhancements
- **Dedicated RPC Dashboard**: Added a brand-new "RPC Configuration" tab to the Web Dashboard sidebar, complete with Public Fallback awareness and full support for all Mainnet and Testnet environments.
- **DeFi Configuration Refactor**: Overhauled the "DeFi Configuration" interface layout to utilize a clean, elegant horizontal list design, achieving absolute visual consistency with the new RPC module.
- **Clean Daemon Boot (NPM Suppression)**: Refactored `launcher.ts` and `package.json` to directly invoke local binaries (`./node_modules/.bin/ts-node`), completely bypassing `npx`. This definitively eliminates the annoying `npm warn allow-scripts` console spam during the multi-service boot sequence.

## [26.6.13]
### Bug Fixes & UX Hardening
- **Telegram Reasoning Leak**: Implemented a strict Regex pre-processor within the Telegram `formatToTelegramHTML` pipeline to silently intercept and annihilate raw `<think>` and `<thought>` Chain of Thought XML tags. This guarantees a clean, distraction-free user experience when integrating reasoning models (like DeepSeek R1) via the Telegram Bot interface.
- **Zero-LLM Fast Return (Instant UI Popups)**: Re-enabled the `fastReturnTools` bypass architecture for all transactional Web3 skills (transfer, swap, bridge, etc.). This optimization skips the redundant secondary LLM summarization phase, cutting transaction generation latency by 3-10 seconds and delivering the UI Approve/Reject popup instantly upon tool completion.
- **One-Liner Transaction UX**: Radically refactored the raw `TRANSACTION_PENDING` LLM string outputs across 9 Web3 modules (Bridge, Swap, Transfer, DeFi Lending, etc.) into ultra-sleek, single-line Markdown formats. This maximizes screen real-estate and delivers an HFT (High-Frequency Trading) aesthetic to the Dashboard and Telegram chat interfaces.
- **Critical KyberSwap Vulnerability Patch**: Fixed a fatal logic bug in the Mainnet Meta-Aggregator where the `txPayload.value` for KyberSwap routes was erroneously mapped to `amountInUsd`. This bug would cause Native ETH swaps to revert (due to insufficient WEI value mismatch) and ERC20 swaps to leak dust ETH. The aggregator now dynamically calculates strict WEI values based on the asset type.

### Cross-Chain Architecture
- **L2 Asynchronous Watcher**: Built a robust Node.js background daemon (`bridgeWatcher.ts`) to autonomously track the 7-day L2-to-L1 challenge periods. This completely modernizes withdrawal operations from blocking UI threads to a passive, state-managed background cron-job.
- **Push Notifications with Inline Actions**: Telegram gateway now natively supports pushing spontaneous server-to-client alerts. The L2 Watcher triggers an immediate Telegram push notification the exact minute an L1 Claim becomes valid, complete with an inline `[ Approve Claim ]` callback button.
- **Universal OP Stack Native Bridge**: Implemented a dedicated `nativeOpBridge.ts` module hardcoded with strictly validated (EIP-55 fully lowercased) `L1StandardBridgeProxy` addresses for both Base Sepolia and OP Sepolia. Nyxora can now encode and simulate native OP Stack portal deposits without relying on external APIs.
- **Testnet Meta-Aggregator Hierarchy**: Overhauled the logic inside `aggregatorTestnet.ts`. The router now intelligently prioritizes the `nativeOpBridge` for all OP Stack chains, gracefully degrading to `fetchRelayTestnet` for Base and `fetchArbitrumBridgeTestnet` for Arbitrum exclusively.

## [26.6.12]
### Security & Web3 Routing
- **Relay API Mainnet Fallback**: Fixed a critical routing bug for native ETH. The aggregator now precisely translates the native token identifier (`0xeeee...`) into the Zero Address (`0x0000...`) exclusively when communicating with Relay's cross-chain API. This completely neutralizes "Invalid input currency" rejections on mainnet bridges.

### Documentation & Architecture
- **Guarded Autonomy Reboot**: Completely rewrote the core conceptual architecture documents (`guarded_autonomy.md`). Eradicated legacy "Quantitative Scoring Engine" hallucinations, solidly aligning the documentation with Nyxora's actual production architecture: a free-thinking AI sandboxed by an immutable, local NLP Policy Engine interceptor.
- **Slippage & Security Guide**: Added a dedicated, comprehensive page (`slippage.md`) clearly delineating the operational differences between the AI's *Default Slippage* and the strict *Max Allowed Slippage* security hard-limit to educate users on MEV and honeypot attack vectors.
- **Roadmap Cleansing**: Removed completed technical milestones (e.g., Universal MCP Client Integration) from the `roadmap.md`. The roadmap now exclusively highlights high-tier enterprise visions such as the Rust-Native Signer and Multi-VM Solana architecture.

### Maintenance & Refactor
- **Clean Installation Initiative**: Completely removed `exceljs` to eliminate all `npm warn deprecated` warnings (e.g., `inflight`, `rimraf@2`, `glob@7`) during global installations. 
- **Modernized Excel/CSV Engine**: Refactored `generateExcel.ts` and `analyzeDocument.ts` to use ultra-lightweight, zero-dependency modern libraries (`write-excel-file` and `csv-parse`), ensuring a 100% warning-free and vulnerability-free `npm install -g nyxora` experience.

### Dashboard & UI Refactoring
- **Clean Agent Reasoning UI**: Restructured the frontend message rendering (`App.tsx`) to completely isolate and strip out raw `<think>` blocks from the AI's internal Chain of Thought. The user interface is now 100% focused on final outputs, keeping the conversation view clean.
- **Strict Think Block Escaping**: Hardened the system prompt in `reasoning.ts` with a new Anti-Hallucination rule. The AI is now strictly forbidden from injecting conversational text or final answers inside the `<think>` block, completely neutralizing the bug where the UI appeared to be "stuck" due to missing output.

## [26.6.11-2]
### Hotfixes
- **Monorepo Dependency Resolver**: Fixed an NPM workspace bug by elevating internal package dependencies (`playwright`, `twitter-api-v2`, `@notionhq/client`) directly to the root `package.json`, completely resolving `Error: Cannot find module` crashes during daemon boot.

## [26.6.11-1]
### Hotfixes
- **Global Installation Path Fix**: Included the compiled `dist/` directory into the NPM tarball, preventing `ts-node` fallback crashes during `nyxora start`.

## [26.6.11]
### Security
- **Foundry Registry Migration**: Successfully migrated the `NyxoraAgentRegistry` Arbitrum Smart Contract from Hardhat to Foundry, stripping out hundreds of vulnerable NPM dependencies and drastically reducing the attack surface.

### Core AI Engine (Reasoning V2)
- **Zero-Hallucination Framework**: Injected 11 new advanced Critical Rules into the core System Prompt (`reasoning.ts`). The AI is now explicitly forbidden from guessing or hallucinating missing parameters (tokens, chains, amounts) and will gracefully ask for user clarification.
- **Transaction Intent Confirmation**: Mandated a strict 4-step execution flow for all state-changing actions. The AI must gather details, display a markdown summary, await UI approval, and only then execute.
- **Network Safety & Risk Disclosure**: For high-level financial strategies (e.g., "Find yield"), the AI is now required to draft a plan and explicitly disclose major DeFi risks (Impermanent Loss, Smart Contract Risk) before requesting execution approval.

### Web3 Architecture Restructuring
- **Separation of Concerns (SoC)**: Completely restructured the `web3` engine into isolated domains (`aggregator/`, `skills/`, and `config`). The AI business logic (`skills/`) is now entirely decoupled from the routing execution layer, enabling massive scalability without spaghetti code.
- **Testnet/Mainnet Contamination Shield**: Aggregator logic is now strictly split between `aggregatorMainnet.ts` (1inch/0x/LI.FI) and `aggregatorTestnet.ts` (Relay). This absolute physical separation ensures experimental testnet logic can never leak into or crash production mainnet operations.
- **Zero-Trust AI Sandbox**: The AI no longer has direct access to execution paths. It can only call functions within `skills/` to prepare transaction drafts, which are then passed to `defiRouter.ts` for strictly controlled optimal routing.

### Performance & Security
- **Native EOA Transfer Fast-Path**: Integrated a strict `getCode` verification check in `transfer.ts`. If the recipient is confirmed as a pure EOA (`0x`), the AI immediately bypasses costly `estimateGas` dry-runs and injects a raw `21000` gas limit, achieving instant P2P Native Transfers. ZK-aware.
- **JSON-RPC Rate Limit Optimization**: Implemented `batchSize: 100` chunking for all `createPublicClient` HTTP transports, coupled with a WSS Auto-Reconnect mechanism that gracefully degrades to HTTP polling.
- **Multicall Chunking & Self-Healing Cache**: Refactored `tokens.ts` metadata fetching using batched `multicall` with persistent self-healing caching. Added Background Preload Allowance dynamic checking on boot.
- **Independent Parallel Execution**: Refactored `swapToken.ts` to perform Quote fetching and Balance checking in strict parallel via `Promise.all`.
- **Safe-Path Enforcement**: Added mandatory `estimateGas()` dry-runs in complex DeFi transactions to detect reverts before broadcasting, saving user gas fees.
- **Meta-Aggregator Architecture**: Built `defiRouter.ts` to seamlessly route Mainnet transactions to 6 competing APIs (1inch, 0x, LI.FI, Relay, OpenOcean, KyberSwap) for best quotes, while exclusively routing all Testnets (e.g. `base_sepolia`) via Relay to prevent conflicts.
- **DeFi Keys (BYOK) Security**: Added a unified `defiConfigManager.ts` securely saving API Keys in `~/.nyxora/defi_keys.yaml` to prevent leaks. Integrated a Dashboard UI panel with `IS_SET` masking so sensitive keys never return to the browser frontend. Removed all insecure `process.env` dependencies.
- **Unified Chain Registry**: Consolidated all supported Mainnet and Testnet network IDs into a single `chains.ts` registry, completely eliminating hardcoded chain bugs across the Dashboard UI and CLI logic.

## [26.6.10] - 2026-06-09

### The DeFi Optimization Update
- **DeFi Lending Engine**: Integrated native Aave V3 support across all EVM chains. The AI can now autonomously fetch dynamic `Pool` addresses via `PoolAddressesProvider` and securely draft `supply` payloads to earn yield on idle assets.
- **DeFi Security Guard (Revoke)**: Shipped a critical security skill allowing users to purge "Infinite Approvals". The AI can now construct 0-value `approve()` payloads to instantly revoke access from malicious or vulnerable smart contracts across any chain.
- **DEX LP Manager**: Integrated Uniswap V3 (and PancakeSwap V3 for BSC) liquidity provision. Enforces strict safety barriers by mandating human-in-the-loop input for `tickLower` and `tickUpper` price ranges, completely neutralizing AI hallucination risks in complex liquidity deployments.
- **Auto-Compounder Vaults**: Integrated Beefy Finance (Primary) and Yearn Finance (Secondary). The AI can seamlessly route idle LP tokens into auto-compounding smart contracts to automatically maximize yield.
- **Transaction Chaining (Smart Approve)**: Upgraded the `viem` contract simulator to intelligently read user allowances prior to execution. If a user attempts to supply Aave or deposit to Beefy without prior authorization, the AI will autonomously intercept the request and draft a precise `approve` payload first, drastically improving UX.
### Enterprise Reporting & History
- **Automated Excel Reporting**: The AI can now autonomously generate formatted `.xlsx` reports from raw JSON data (e.g., PnL, token balances) via the new `generate_excel_file` OS Skill.
- **Deep Transaction History**: Integrated `get_tx_history` Web3 skill to fetch complete 30-day (or N-day) history for Native and ERC-20 transfers using the new Unified Etherscan API V2. A single API key now powers cross-chain fetching across 60+ Mainnets and Testnets, featuring a graceful fallback mechanism to public endpoints.

### The Masterpiece Memory Architecture
- **Air-Gapped Security Vault**: Implemented a strict 4-Layer Memory Architecture. The LLM Reflection Engine is now completely air-gapped from the OS Keyring and Wallet System, establishing absolute immunity against memory-based Private Key leakage.
- **Hard-Coded Anti-Injection Validator**: Deployed a rule-based RegExp Validator (`validator.ts`) acting as the ultimate gatekeeper before SQLite insertion. It autonomously detects and annihilates Private Keys, 12/24 BIP-39 Seed Phrases, API Tokens, and System Prompt Override attempts without relying on LLM behavior.
- **Smart Suggestion Engine**: The Agent Reasoning Pipeline now natively hooks into the Layer-2 Episodic Database. By injecting the top 10 most confident habits directly into the System Prompt, Nyxora can now autonomously autocomplete repetitive transaction parameters (e.g., preferred network, preferred token) slashing human-in-the-loop latency by up to 90%.
- **Persistent Background Reflection**: Eliminated static interval timers. The Reflection Engine is now seamlessly triggered via 3 infallible hooks: a 3-minute Idle Timer, an N-Message threshold (every 5 messages), and a `SIGTERM` Graceful Shutdown hook, ensuring resilient memory retention across daemon lifecycles.
- **Real-Time Memory Log Dashboard**: Exposed a robust `/api/memory` CRUD endpoint and integrated a sleek "Memory Log" panel directly into the Web Dashboard Overview tab. Users can now audit, review confidence scores, and forcefully delete false observations in real-time with zero state desynchronization.

## [26.6.9]
### Security & UX Hardening
- **Zero-Trust Auto-Lock (Passwordless)**: Implemented a robust idle timeout mechanism in the React Dashboard with an elegant glassmorphism blur overlay. The dashboard securely locks after periods of inactivity, requiring the user to authorize unlock directly via the CLI (`nyxora unlock`) to prevent unauthorized local access.
- **Approval Replay Protection (Nonce Guard)**: Hardened the `transactionManager` to cryptographically sign all pending transaction payloads with a randomized 16-byte Nonce. The `/api/transactions/:id/approve` endpoint now strictly enforces Nonce matching and immediately marks it as `used_` upon first validation, completely eliminating double-spending and Replay Attack vectors.
- **Graceful Shutdown (SQLite WAL Guard)**: Integrated deep `SIGTERM` and `SIGINT` signal listeners within the Gateway server. When the daemon is halted, the system now safely terminates active incoming requests and explicitly invokes `logger.close()` to securely flush SQLite Write-Ahead Logs (WAL) before exiting, completely eliminating the risk of database corruption.
- **Resilient UI (Reconnect Overlay)**: Engineered a global network interceptor inside the Dashboard's React `apiFetch` utility. If the daemon goes offline unexpectedly or is restarting, the UI instantly pauses and deploys a transparent, pulsing "Nyxora Daemon Offline" screen. Once the daemon is revived, the overlay automatically lifts, preserving the user's workflow seamlessly.

### Architecture & Production Readiness
- **Dynamic Port Anti-Collision**: Replaced the hardcoded `3001` Policy Server port with a dynamic `process.env.POLICY_PORT` fallback. All Web3 Agents (Bridge, Swap, Transfer, etc.) are now dynamically linked to this environment variable, completely eliminating `ECONNREFUSED` crashes when port 3001 is occupied by other local developer applications.
- **Production-Ready Path Resolution**: Eliminated hardcoded `process.cwd()` dependencies across the Gateway, Dashboard, and Plugin Manager. The CLI now utilizes robust absolute `__dirname` and `getAppDir()` traversal, guaranteeing the Dashboard UI and External Skills load flawlessly regardless of where the global CLI command is executed from.


## [26.6.8]
### Enterprise Features & Web3 Enhancements
- **Zero-Downtime Directory Migration**: Restructured the root `~/.nyxora` local data directory into a strict `config/`, `data/`, `auth/`, and `run/` subdirectory architecture. Implemented a Lazy Auto-Migration Engine (`getPath()`) that seamlessly relocates legacy files to their new secure zones instantly upon access, ensuring zero-downtime and zero-data-loss upgrades for existing users.
### Security & UX Updates
- **Proactive Anti-Crash Engine**: Implemented `Max Retry` & `Exponential Backoff` auto-respawn logic inside the Monorepo Launcher. The daemon now features robust global `unhandledRejection` and `uncaughtException` guards across the Core, Policy, and Signer subsystems, ensuring sporadic Web3 network timeouts can no longer crash the main reasoning engine.
- **Death Loop Telegram Alerts**: Integrated a critical emergency monitoring system into the Launcher. If a core microservice crashes catastrophically (5 times within 1 minute), the daemon will autonomously initiate an emergency lock-down to protect the system state and immediately broadcast a high-priority alert directly to the administrator's Telegram.
- **Unix Socket Anti-EADDRINUSE Guard**: Implemented aggressive pre-flight cleanup routines for the `nyxora-signer.sock` IPC channel. The system now guarantees secure file unlinking before rebinding, eliminating recurring `EADDRINUSE` daemon failures upon rapid restart commands.

### Bug Fixes & Optimizations
- **NPM Package Optimization**: Added `assets/` to `.npmignore` to exclude large architectural diagrams and images from the NPM registry tarball, reducing the total package download size by over 11 MB.
- **Docker Multi-Stage Build**: Radically refactored `Dockerfile` to a Multi-Stage architecture. The production image now exclusively installs runtime dependencies (`--omit=dev`) and leaves behind heavy build tools (`python3`, `make`, `g++`), dramatically shrinking the final container image size.
- **Docker Security Patch**: Hardened `.dockerignore` to explicitly block local keystores (`keystore.json`), persistent memory (`memory.db`), and local credentials from accidentally leaking into Docker image layers during local builds.

## [26.6.7]
### Enterprise Features & Web3 Enhancements
- **Enterprise Portfolio Scanner**: Integrated a fully decentralized, real-time Dashboard UI (Nord Theme) to scan all native and ERC-20 token balances across 8 EVM chains natively, without relying on centralized third-party APIs.
- **Real-Time USD Valuation**: Integrated DexScreener API into the Portfolio Scanner backend to actively compute and display USD portfolio values in real-time. Features an adaptive 2-minute memory cache system to ensure complete immunity against API rate-limits and eliminate LLM token consumption.
- **Official Web3 Branding**: Integrated TrustWallet and CovalentHQ CDNs to automatically resolve and render official Native Chain icons and ERC-20 Token logos with dynamic address casing, delivering an authentic Tier-1 exchange aesthetic.
- **Custom Token Management (AI Skill)**: Deployed the new `manage_custom_tokens` Web3 skill. The AI agent can now autonomously recognize, store, and manage user-specified custom token addresses (e.g., obscure/degen tokens) to `~/.nyxora/custom_tokens.json`. These are instantly synced with the Portfolio Scanner.
- **MEV-Blocker Integration**: Upgraded the Ethereum mainnet routing core in `config.ts` to strictly prioritize `rpc.mevblocker.io` and `rpc.flashbots.net` as primary transports. All user transactions are now forcefully routed through Private Mempools, establishing complete immunity against sandwich attacks and front-running bots.
- **System Diagnosis (`nyxora doctor`)**: Added a new CLI tool `nyxora doctor` to automatically verify OS requirements, node versions, filesystem permissions, SQLite database r/w access, Keyring vault security, and network port availability for seamless troubleshooting.

### Security & UX Updates
- **CLI Wallet Management (`nyxora wallet update`)**: Added a highly requested sub-command to allow users to securely overwrite their OS Keyring Web3 wallet directly via the CLI without having to re-run the full LLM setup wizard. Features an aggressive visual confirmation step to prevent accidental Private Key destruction.
- **Terminal UI Resilience**: Replaced dynamic `note()` text rendering with static linear console logs in the `nyxora setup` wizard. This completely eliminates a UI truncation bug where the `clack` prompter would swallow the 12-word mnemonic phrase on small terminal windows.
- **Helmet CSP Optimization**: Adjusted the Gateway Server's Content Security Policy (CSP) to securely whitelist decentralized image repositories (GitHub raw, CovalentHQ) without compromising strict anti-XSS protection protocols.
- **BIP-39 Mnemonic Generation**: Upgraded the `nyxora setup` CLI wizard. When auto-generating a new wallet, the system now provides a standard 12-word Seed Phrase (Mnemonic) instead of a raw hex Private Key, vastly improving user security and cross-wallet compatibility (e.g., MetaMask). The private key is still autonomously extracted and locked in the OS Keyring.
- **One-Liner Install Script**: Added a new hacker-style `curl | bash` installation method at `https://nyxoraai.github.io/Nyxora/install.sh` for Linux/macOS, and a native PowerShell script `install.ps1` for Windows, providing an instant, frictionless setup experience across all major operating systems.
- **Global Localization Standardization**: Swept and translated the entire AI reasoning log engine (`reasoning.ts`) from Indonesian to standardized English to maintain strict international professional standards across console output and UI feedback.

### Bug Fixes & Optimizations
- **ERC-20 Decimals Resolution**: Completely eradicated a critical math bug where all custom tokens were assumed to have 18 decimals. The backend now executes parallel `decimals()` on-chain queries alongside `balanceOf()`, guaranteeing 100% mathematical precision for tokens like USDC/USDT (6 decimals).
- **NPM Monorepo Build Fix**: Fixed the `packages/core` workspace `package.json` to correctly include the `"build": "tsc"` script and aligned its internal versioning (`v26.6.7`). This resolves the NPM workspace lifecycle crash during global build triggers.
- **NPM Optimization**: Added official keywords (`web3`, `ai`, `agent`, `crypto`, `mcp`, `automation`, `defi`, `zero-trust`) to the root `package.json` to significantly improve Nyxora's discoverability and SEO on the NPM Registry.

## [26.6.6]
### Enterprise Stability Upgrades
- **Strict LLM Output Validation**: Added robust try-catch parsing for LLM tool arguments in `reasoning.ts`. If the AI outputs malformed JSON, the error is fed back into the reasoning loop, allowing the model to autonomously self-correct without crashing the agent pipeline.
- **Transaction Simulation (Dry-Run)**: Integrated `publicClient.estimateGas` in the Signer Vault before broadcasting transactions. This ensures all Web3 transactions are simulated at the node level, preventing users from wasting gas fees on reverted transactions (e.g., due to insufficient slippage or balance).
- **Graceful Shutdown (Keyring Security)**: Replaced `SIGKILL` with `SIGTERM` in `launcher.ts` and added explicit process termination listeners in the Signer server. When a user exits the CLI using `Ctrl+C`, the system elegantly clears the in-memory `vaultPrivateKey` reference and unlinks unix sockets, securing the local Keyring vault before terminating.
- **Undefined Function Fix**: Fixed a silent `TypeError` bug in `reasoning.ts` where a failed LLM parsing attempt would call an undefined `executeReasoningLoop` function. Now gracefully loops via standard `logger.addEntry` continuation.

### Bug Fixes & UX Enhancements
- **Destructive Config Overwrite Fix**: Fixed a critical bug in `/api/config` where saving settings via the Dashboard UI would silently delete the user's Telegram Bot token and system permissions. The API now performs a deep merge with `config.yaml`.
- **Asynchronous Transaction UI**: Detached the Web3 transaction execution loop from the Dashboard UI `/approve` endpoint. Approvals now instantly return a success state to the UI (preventing 3-minute freezes) while the transaction safely confirms in the background and reports back via chat.

### Performance & Speed Optimizations
- **SQLite Indexing (O(1) Lookup)**: Added an automatic `CREATE INDEX` for `session_id` in the memory logger database, drastically reducing query latency from O(n) full table scans to instantaneous lookups for large chat histories.
- **Sliding Window Context Limit**: Overhauled `getHistory()` with an SQL subquery `LIMIT 40` approach. The agent now only feeds the most recent 40 messages to the LLM context, massively reducing API token costs and preventing latency bloat.
- **Pre-Compiled Runtime (ts-node Elimination)**: Replaced on-the-fly TypeScript compilation (`ts-node`) with ahead-of-time compilation (`tsc`). `launcher.ts` and `nyxora.mjs` now natively detect and execute compiled `.js` files from the `dist/` directory, resulting in near-instant daemon startup times.
- **Global Token Metadata Cache (OOM Protected)**: Implemented an in-memory Bounded LRU Cache (max 1000 items) in `tokens.ts` for caching `decimals` and `symbol`. This eliminates repetitive RPC calls for immutable token data, shielding the system from Out-Of-Memory crashes if spammed with fake tokens.
- **Web3 RPC Parallelization**: Refactored `transfer.ts`, `swapToken.ts`, `bridgeToken.ts`, and `getBalance.ts` to replace slow, sequential `readContract` calls with `Promise.all` fetching via `getTokenMetadata()`. Web3 action preparation latency has been reduced to near 0ms for cached tokens.

## [26.6.5-1.0]
### Bug Fixes & Improvements
- **Transaction Stability**: Added 30-second `AbortSignal` timeout safety net across all Web3 skills (`swapToken`, `transfer`, `bridgeToken`, `mintNft`, `customTx`) to prevent UI hanging when RPC nodes are unresponsive.
- **Multi-Session Transaction Logs**: Fixed an issue where Web3 transaction status messages (Approve/Reject/Success/Failure) were logged to the `default` session instead of the user's active session window, by attaching the correct `sessionId` with `Content-Type: application/json` headers in dashboard API requests.
- **UI Tool Rendering Bug**: Fixed a React rendering bug in `App.tsx` where the AI's internal tool execution notification (green bubble) would be hidden if the AI generated both conversational text and a tool execution in the same response.
- **Base Sepolia Support**: Officially added `base_sepolia` testnet to the supported networks list and `bridgeToken` mappings to prevent AI confusion when resolving bridge destinations.
- **Default Policy Override (Plug & Play)**: Adjusted the default `config.yaml` template and internal Policy Engine defaults to set `allow_transfer`, `allow_swap`, `allow_shell_execution`, and `allow_file_write` to `true`. Also uncapped `max_usd_per_tx` to `$999,999,999` by default, ensuring a seamless "plug and play" experience for new users without needing manual configuration edits.
- **Viem RPC Timeout**: Injected a strict 15-second timeout inside the `signer` vault's `viem` HTTP transport to prevent indefinite freezing during blockchain gas estimation when the node is heavily rate-limited.
- **Auto-Approve Signature Fix**: Added internal HMAC signature generation across all Web3 transaction execution modules (Transfer, Bridge, Mint, CustomTx) to resolve the `Missing internal signature for autoApprove` error during manual dashboard approvals or policy bypasses.
- **LayerZero Testnet Route**: Upgraded the testnet Bridge mock implementation to utilize LayerZero's V2 Endpoint router (`0x1a44...`) for simulated testnet bridging transactions.
- **Transaction Result Formatting**: Fixed an issue where the AI would output raw JSON stringified payloads for successful transactions. The chat notification is now properly formatted to clearly display the transaction hash.
- **Base Sepolia UI Integration**: Synchronized the Dashboard's Network Selector dropdown and Default Web3 Chain settings menu to include the newly added `Base Sepolia (Testnet)` network.
- **LayerZero Mainnet Removal (Stargate V2)**: Completely removed the experimental LayerZero/Stargate V2 integration from the core bridging engine to prevent interaction with potentially outdated or unverified mainnet smart contracts. Removed the corresponding "LayerZero" routing option from the Dashboard UI dropdown to ensure a highly stable and secure bridging experience exclusively via Li.Fi and Relay.
- **Relay MEV Protection (Slippage)**: Hardened the `getRelayQuote` HTTP POST request by injecting a strict `slippageTolerance` parameter (default 0.5%). This closes a critical vulnerability where unbounded Relay executions could expose user funds to front-running and MEV attacks during volatile market conditions.
- **Strict NLP Exactness (Rule 8)**: Injected CRITICAL RULE 8 into the core reasoning pipeline (`reasoning.ts`). The AI is now strictly forbidden from hallucinating or guessing ambiguous transaction parameters (tokens, amounts, or destination networks). It will automatically halt and politely ask the user for explicit clarification before constructing any Web3 payloads.
- **NLP Context Override System**: Documented the NLP fallback override mechanism in `README.md` and Vitepress documentation to clarify how explicit user chat instructions dynamically bypass Dashboard configurations.

### UI/UX Fixes
- **Pending Transactions Widget**: Fixed a rendering bug where the Approve/Reject popup was not being injected into the DOM, preventing users from signing transactions.

### Core AI Engine
- **Strict Language Matching**: Optimized CRITICAL RULE 2 in the System Prompt. The AI now completely ignores historical chat language context and strictly matches the language of the user's latest prompt.

## [26.6.5] - 2026-06-04 (Hotfix Patch)
### Fixed
- **NPM Monorepo Resolution:** Synced `@inquirer/search` and `duck-duck-scrape` to root `package.json` to prevent `MODULE_NOT_FOUND` and `ERR_CONNECTION_REFUSED` on global installations.

## [26.6.4]

### AI Engine Optimizations
- **Semantic Keyword Router (Zero-Latency)**: Restructured the `reasoning.ts` pipeline to dynamically group tools into specific clusters (`WEB3`, `SYSTEM`, `GOOGLE`). The engine now intercepts the user's prompt using highly optimized Regex keyword-matching. This eliminates "Context Bloat" by only injecting relevant tools into the LLM payload, dramatically increasing LLM responsiveness and minimizing API token consumption.
- **Zero-LLM Fast Return Expansion**: Expanded the V2 `Fast Return` optimization (which skips the redundant secondary LLM summarization step) to include 7 additional data-heavy read-only tools: `get_price`, `get_my_address`, `analyze_market`, `check_token_security`, `search_web`, `read_gmail_inbox`, and `list_calendar_events`. For these queries, the agent now returns the raw markdown payload instantaneously, cutting response latency by 50-80%.

### Universal LLM Expansion
- **Dictionary Mapping Refactor**: Completely flattened the massive `if-else` blocks in `reasoning.ts` into a highly dynamic 15-line dictionary map. Adding new LLM providers in the future now only takes a single line of code.
- **Expanded Provider Ecosystem**: Added native support for **Groq, Mistral AI, xAI (Grok), dan DeepSeek**, seamlessly integrated into the React Dashboard UI's dropdown. 

### CLI Enhancements
- **Searchable Model Prompt**: Replaced the static `@clack/prompts` list with `@inquirer/search` inside `nyxora setup`. Users can now instantly fuzzy-search their desired AI model out of dozens of variants using their keyboard.
- **2026 Model Roster**: Injected an exhaustive list of the latest frontier models into the CLI (including `gpt-5.5`, `o3-mini`, `gemini-3.1-pro`, `deepseek-reasoner`). A fail-safe `[Tulis Manual / Custom Model]` option is also hardcoded at the bottom of every list.

### Backend Stability (Core Engine)
- **Zero-Crash SQLite (WAL Mode)**: Enabled `PRAGMA journal_mode = WAL` and `busy_timeout = 5000` on the `node:sqlite` database engine (`logger.ts`). This allows parallel reads and writes without throwing fatal `SQLITE_BUSY` (database locked) errors during high-concurrency operations.
- **Anti-Zombie LLM Timeout**: Hardcoded a `timeout: 120000` (120 seconds) limit on the core OpenAI SDK instantiation (`reasoning.ts`). If an external AI provider (e.g., local Ollama or OpenRouter) hangs, the system will now correctly severe the connection and trigger Exponential Backoff rather than freezing indefinitely. Disabled internal SDK retries (`maxRetries: 0`) to prevent retry collisions with Nyxora's native retry wrapper.

### UI & Developer Experience
- **CLI Memory Purge**: Introduced a new developer utility command: `nyxora clear`. It instantly and atomically resets the AI's short-term/long-term memory SQLite database. Includes a mandatory `--force` flag safeguard to prevent accidental data destruction.
## [1.7.3]

### Web3 Routing & Integrations
- **Multi-Router Selection (DeFi)**: Added a dynamic Router dropdown to the Dashboard UI, allowing users to forcefully route transactions through specific protocols natively. Supported routers include `1inch`, `CowSwap (MEV-Protected)`, `Li.Fi`, `Relay`, `Uniswap V2`, `Uniswap V3`, and `PancakeSwap`. This integration heavily relies on deep aggregator proxying (bypassing the need for complex V2/V3 ABI calldata overhead) to ensure 100% smooth, anti-fail execution without requiring additional API keys.

### Security & Polish
- **Dashboard:** Redacted the sensitive Nyxora Auth Token from appearing in the Gateway Logs component on the frontend to prevent visual leakage during screen sharing or screenshots.

## [1.7.2]

### UI/UX Enhancements
- **Google Workspace Logout**: Users can now easily disconnect their Google Workspace accounts directly from the Dashboard (OS Skills tab). This triggers a secure token purge from both the OS Keyring and local storage, ensuring privacy and seamless account switching.

### Cloud-Native Deployment
- **Official Docker & GHCR Support**: Added comprehensive Docker containerization support (`Dockerfile`) and automated publishing pipelines to GitHub Container Registry (GHCR). 
- **Docker Documentation**: Added a dedicated `DOCKER.md` guide explaining how to pull, interactively configure, and run the Nyxora daemon via Docker with isolated Volume storage (`/root/.nyxora`).

### Documentation & Compliance
- **Legal Infrastructure**: Added standard `Privacy Policy` (`privacy.md`) and `Terms of Service` (`terms.md`) to the VitePress documentation to prepare for official Google OAuth App Verification.
- **Enterprise Roadmap Evolution**: Updated the documentation roadmap to reflect our "Nyxora Next Update" vision, outlining future plans for a Rust-Native Signer, Idempotent Policy Engine, Multi-VM Architecture, and Google App Verification.

## [1.7.1]

### CLI Enhancements
- **Global Version Checker**: Implemented native version checking for the global CLI manager. Users can now run `nyxora -v`, `nyxora --version`, or `nyxora version` to instantly check their installed daemon version without starting the application.
- **Smart Web Search Setup Wizard**: The `nyxora setup` command now includes an interactive prompt allowing users to choose their preferred Web Search Engine (Tavily, Brave, or Decentralized Mesh) and configure their API keys.
- **Fast CLI Shortcuts**: Added the `nyxora set-key <provider> <key>` global command shortcut allowing developers to quickly inject or override any API Key (OpenAI, Gemini, OpenRouter, Tavily, Brave) directly into the secure vault without traversing the wizard.

### AI Engine Optimizations

- **Web Search Smart Memory Cache**: Embedded a local Memory Cache (`Map`) into the `searchWeb` skill with a 5-minute (300,000ms) TTL. Exact duplicate queries now execute in 0ms and consume 0 API quota, dramatically improving conversation flow.
- **Deep Research Mode**: The `search_web` tool definition now accepts a dynamic `depth` parameter (1 to 3). If users instruct the AI to conduct comprehensive research, Nyxora will automatically trigger `advanced` API payloads and extract up to 15 top web snippets simultaneously.
- **Strict Skill Prioritization**: Added CRITICAL RULE 7 to the core NLP System Prompt. The AI is now hard-coded to prioritize native Web3 Skills (e.g. `get_price`, `analyze_market`, `check_security`) for all crypto-related queries, using `search_web` exclusively as a fallback mechanism.
- **Dual-Engine Web Search (L3 Failover)**: Completely removed the fragile `duck-duck-scrape` dependency. The `search_web` skill is now powered by a robust L3 Auto-Failover architecture. Users can configure enterprise-grade search providers (Tavily or Brave). If the primary provider hits a rate limit (429) or invalid key (401/403), Nyxora seamlessly falls back to the secondary provider, and ultimately to a Decentralized SearXNG Mesh as a final safety net, guaranteeing 100% uptime.


## [1.7.0]

### Bug Fixes & Optimizations
- **Time Sync Hallucination**: Fixed a critical issue where the AI hallucinates the current date and time. Nyxora now dynamically injects the host OS's exact `new Date().toLocaleString()` into the system prompt upon every execution.
- **Aggressive UI Auto-Scroll**: Resolved a severe React rendering bug in the dashboard where the 2-second history polling forced the chat window to aggressively scroll to the bottom. Auto-scroll is now strictly isolated to new message arrivals (`messages.length`).
- **Orphaned OS Skills**: Re-wired the `search_web` (Internet Search) and `analyze_document` (PDF/DOCX Extractor) skills back into the core reasoning engine. These skills were previously orphaned and inaccessible to the AI despite being active in the dashboard.
- **Multicall3 Portfolio Engine**: Fully replaced parallel `client.getBalance` and ERC20 fetching with a hyper-efficient `Multicall3` architecture. Balances are now chunked (max 30 tokens per batch) to guarantee zero rate-limits and payload errors on public RPCs.
- **ChatGPT-Level NLP Persona**: Upgraded the AI's core reasoning engine to natively understand unstructured text, slang, and informal contexts. Rigidly enforced Markdown Table generation for all financial data.
- **Telegram HTML Parser**: Implemented a custom `formatToTelegramHTML` function. Nyxora now escapes dangerous characters (`<`, `>`, `&`) and automatically wraps AI-generated Markdown tables into `<pre>` monospaced blocks, completely eliminating the "Bad Request" rendering crash on Telegram.
- **Dynamic Tx Formatter (Tap-to-Copy)**: The post-transaction approval message is now bilingual (auto-detecting English/Indonesian from chat history). Transaction Hashes and wallet addresses are wrapped in `<code>` tags for seamless tap-to-copy UX on mobile devices.
- **CLI Setup Typography**: Updated outdated CLI prompts that falsely referenced legacy `AES-256-GCM` encryption. The CLI now correctly informs the user that Private Keys are securely locked inside the OS Native Keyring Vault.

## [1.6.7]

### UI/UX
- **New Nyxora Brand Logo**: Replaced the standard dashboard `Bot` icon with a native, 100% transparent SVG component of the Nyxora Cosmic Star.
- **Dashboard Avatar Overhaul**: Removed the rigid box border/shadow surrounding the agent avatar and maximized the logo scale (from 28px to 48px) for a bold, premium aesthetic.
- **SVG Optimization**: Cropped the internal viewBox (padding) of the logo to ensure it renders with maximum density and solidity at any resolution.
- **Favicon Update**: Synchronized the browser tab favicon with the newly optimized Nyxora logo.
- **Network Sync**: Synchronized network dropdown ordering (ETH > BSC > Base > Optimism > Arbitrum > Sepolia) across Dashboard UI, Settings, and CLI setup.

### Developer Experience
- **Single-Command Boot**: Introduced `npm run dev` in the root workspace utilizing `concurrently` to launch the backend orchestrator (Vault/Policy/Core) and the Vite frontend simultaneously, providing a seamless "Plug & Play" dev experience.

### Agent Intelligence
- **Cross-Chain Context**: Upgraded the core LLM prompt to automatically detect network mentions in chat (e.g., "on BNB") and override the default chain dynamically.
- **Portfolio Enforcement**: Instructed the agent to prioritize the comprehensive `check_portfolio` tool when users ask for general balances, while providing polite network confirmations.
- **Dust Asset Precision**: Improved portfolio USD calculations to render micro-assets (< $0.01) up to 4 decimal places (e.g., ~$0.0050) preventing inaccurate $0.00 rounding.
- **"Lean Degen" Auto-Whitelist**: AI now automatically intercepts and permanently saves Contract Addresses (CAs) into `user_whitelist.json` whenever users execute token swaps or check specific balances.
- **Dynamic Portfolio Merging**: The `checkPortfolio` engine now executes a hyper-fast, 0% rate-limit risk Multicall that merges standard tokens, user-defined CAs, and CoinGecko's daily trending list into a clean, unified dashboard report.

### Dual-Engine & OS Skills (Google Workspace MVP)
- **Native Google Integration**: Agent can now autonomously interact with Gmail (`read_gmail_inbox`), Google Calendar (`list_calendar_events`), Google Docs (`read_google_docs`), Google Sheets (`append_row_to_sheets`), and Google Forms (`read_google_form_responses`).
- **Security Upgrade (OS Keyring)**: Completely migrated OAuth token storage to the OS-Native Keyring Vault. Google Refresh Tokens are now securely locked and encrypted by the host OS, preventing plaintext credential theft.
- **Performance Optimization**: Scrapped the heavy `googleapis` dependency in favor of lightweight Native `fetch`, resulting in zero NPM install warnings, smaller footprint, and faster execution.
- **Bugfix**: Resolved TypeScript compilation errors (TS2349) related to the `pdf-parse` ESM dependency.
## [1.6.6]

### Hotfix: Global Monorepo Dependencies

This release patches a critical bug where global installations via `npm install -g nyxora` would fail to start the daemon due to missing C++ native modules.

#### Fixes
- **Dependency Hoisting Fix**: Explicitly bundled essential runtime modules (isolated-vm, telegraf, @modelcontextprotocol/sdk) into the root package.json to support monolithic publishing.
- **Zero-Crash Boot**: Resolves the MODULE_NOT_FOUND fatal error for isolated-vm when starting the daemon after a clean global install.
- **Dashboard Stability**: Ensures the background API server connects flawlessly to the React Dashboard without encountering Connection Refused.
## [1.6.5]

### The Universal Bridge (MCP Integration)

Nyxora now natively supports the Model Context Protocol (MCP). This massive upgrade transforms Nyxora from a standalone agent into a Universal Web3 Middleware. External AI clients (like Claude Desktop or Cursor IDE) can now securely interact with the Nyxora ecosystem out-of-the-box.

#### Key Features
- **StdioServerTransport**: Deep integration allowing Claude Desktop to securely spawn Nyxora as a child process.
- **Universal Bridge**: Exposes Nyxora's core crypto actions (swap, transfer, market analysis) as standard MCP Tools.
- **Enterprise Security**: All external MCP commands are strictly routed through Nyxora's battle-tested Policy Engine, ensuring no unauthorized transactions occur.
## [1.6.4]

### Added
- **Node.js Native Database Engine**: Migrated the core `logger.ts` memory subsystem to use the built-in `node:sqlite` engine (Node 22+), maintaining ultra-fast 100% synchronous operations while dramatically reducing dependency bloat.
- **Next-Gen OS Keyring (N-API)**: Migrated `keytar` to `@napi-rs/keyring`. This replaces legacy C++ bindings with modern Rust/NAPI-RS, retaining identical OS-level security (Mac Keychain, Windows Credential Manager) while eliminating the `prebuild-install` deprecation warning and streamlining global installation.

### Removed
- `better-sqlite3` and `keytar` dependencies entirely removed from the monorepo architecture.

## [1.6.3]

### Added
- Implemented **Zero-Click Multi-Session** for instantaneous chat creation and switching.
- Introduced **Smart Auto-Naming** for automatic contextual session titles.

### Changed
- **Redesigned Sidebar Architecture**: enhanced utility-centric design, significantly reducing gaps for a compact, elegant look.
- Integrated **OS-Native Keyring**, replacing legacy AES-256-GCM and Master Password mechanics.
- Updated and cleaned up legacy cryptography references in VitePress guides and README.

### Fixed
- Resolved deeply-nested monorepo CI/CD deployment failures by isolating `package-lock.json` and mitigating peer-dependency conflicts.

## [1.4.5]

### Fixed
- Re-rendered Architecture Workflow diagram as a solid-background PNG to fix dark mode visibility issues.
- Added `assets` directory to the NPM package `files` list so the diagram is included in published packages.
- Added `repository` field in `package.json` for proper GitHub link resolution on NPMJS.
- Updated `README.md` to use the absolute raw GitHub image URL for universal rendering compatibility.

## [1.4.4]

### Fixed
- Fixed Architecture Workflow diagram rendering issue on NPM by replacing the `mermaid` code block with a static SVG image.

## [1.4.3]

### Changed
- Completely rewrote `README.md` (English) to follow the structured, security-first Web3-Ops template. 

## [1.4.2]

### Changed
- Updated `README.md` to highlight Web3-Ops capabilities (System Automation, NLP Security Policies, and Dynamic Plugins).

## [1.4.0]

### Added
- **System Automation Capabilities**: Allow Nyxora to execute shell commands, read/write local files, and browse the web autonomously.
- **NLP Security Policy**: Users can enforce rules (e.g. "do not touch partition E") in plain text via the chat, which Nyxora respects autonomously.
- **Plugin System**: Dynamically load third-party skills from the `src/external_skills` folder without modifying the core codebase.

### Changed
- Moved AI initialization logic to support dynamic importing of external skills.
- UI Settings: Fixed a fatal rendering bug when the configuration lacks `api_keys` array formatting.

### Fixed
- Fixed bug on rendering Settings menu due to incorrect `config.yaml` types.
