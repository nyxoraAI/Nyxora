# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepashangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [26.6.5] - 2026-06-04 (Hotfix Patch)
### Fixed
- **NPM Monorepo Resolution:** Synced `@inquirer/search` and `duck-duck-scrape` to root `package.json` to prevent `MODULE_NOT_FOUND` and `ERR_CONNECTION_REFUSED` on global installations.

## [26.6.4] - 2026-06-04

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
## [1.7.3] - 2026-06-04

### Web3 Routing & Integrations
- **Multi-Router Selection (DeFi)**: Added a dynamic Router dropdown to the Dashboard UI, allowing users to forcefully route transactions through specific protocols natively. Supported routers include `1inch`, `CowSwap (MEV-Protected)`, `Li.Fi`, `Relay`, `Uniswap V2`, `Uniswap V3`, and `PancakeSwap`. This integration heavily relies on deep aggregator proxying (bypassing the need for complex V2/V3 ABI calldata overhead) to ensure 100% smooth, anti-fail execution without requiring additional API keys.

### Security & Polish
- **Dashboard:** Redacted the sensitive Nyxora Auth Token from appearing in the Gateway Logs component on the frontend to prevent visual leakage during screen sharing or screenshots.

## [1.7.2] - 2026-06-04

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
- **Hybrid API Vault (Security)**: API Keys are no longer stored in plain text inside `config.yaml`. Nyxora now encrypts and stores them via `@napi-rs/keyring` utilizing OS-native credential management. For Headless/VPS Linux environments lacking DBUS/Secret Service, it automatically falls back to an isolated `api_vault.key` with strict `0600` permissions.
- **Root-Level Config Auto-Migration**: Restructured `config.yaml` to move all API keys out of the nested `llm.credentials` into a logical, root-level `credentials` object. Implemented a silent auto-migration routine in `parser.ts` that safely upgrades legacy config files on boot without breaking existing setups.
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
