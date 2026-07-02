# Comprehensive Installation Guide

Nyxora is designed for a frictionless onboarding experience. We provide a CLI-based Interactive Setup Wizard that guides you from zero to fully operational in minutes.

---

## Prerequisites
Before installing Nyxora, ensure your system meets the following requirements:
1. **Node.js** (Version 18 or higher).
2. **Python 3.10+** (Required for the ML Cognitive Engine).
3. A minimum of 2GB RAM.
4. A valid API Key from one of the supported providers (OpenAI, Gemini, Anthropic, OpenRouter, Groq, Mistral, xAI, DeepSeek) or a local Ollama instance.

---

## Option 1: One-Line Installation (Recommended)

The fastest way to install Nyxora is via our smart installation wrapper. This script automatically checks for Node.js, installs it if missing, and securely fetches the Nyxora daemon directly from the NPM Registry. *(Note: You must have Python 3.10+ pre-installed on your system, as this script only handles Node.js dependencies).*

**Linux & macOS:**
```bash
curl -fsSL https://nyxoraai.github.io/Nyxora/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://nyxoraai.github.io/Nyxora/install.ps1 | iex
```

---

## Option 2: Global Installation (NPM)

If you already have Node.js installed, you can natively install Nyxora globally via NPM, allowing you to use the `nyxora` CLI command from anywhere on your machine.

```bash
# Install globally
npm install -g nyxora

# Run the interactive setup wizard
nyxora setup

# Start the background daemon
nyxora start

# Open the interactive UI dashboard
nyxora dashboard
```

The interactive command-line wizard (`nyxora setup`) acts as a smart system doctor that automatically validates your Node.js and Python 3.10+ installations before guiding you through:
1. **AI Engine Selection:** Choose your primary LLM provider (OpenAI, DeepSeek, xAI, etc.) and your preferred Web Search provider (Tavily, Brave, DuckDuckGo, SearXNG). Input your API keys securely.
2. **Skill Selection (Pure Assistant Mode):** The CLI will ask if you want to enable Web3 Skills. If you select "No", the CLI generates a `disabled_skills.json` file. This securely locks the agent out of the Web3 Signer and Wallet capabilities, creating a pure, lightweight coding/OS assistant.
3. **Wallet Setup:** Auto-generate or manually securely input an Ethereum/EVM private key into your OS-Native Keyring (if Web3 skills are enabled).
4. **Integration:** Configure optional integrations like the Telegram Bot.

---

## Option 3: Local Development (Source Code)

Nyxora operates on a Monorepo architecture using NPM Workspaces. If you want to run it locally from the source code, modify its behaviors, or contribute to the repository, follow these steps:

### 1. Clone the Repository
```bash
git clone https://github.com/nyxoraAI/Nyxora.git
cd Nyxora
```

### 2. Install Dependencies
Run `npm install` from the root directory to securely install all packages across the monorepo:
```bash
npm install
```

### 3. Build the Packages
Compile the core engine, MCP server, and the React Dashboard by running the build script:
```bash
npm run build
```

### 4. Setup and Launch
Once built, run the setup wizard and start the application:
```bash
# Interactive Setup Wizard (Also installs Python ML dependencies via pip)
npm run setup

# Start the Application (Spawns Node.js Core and Python FastAPI sidecar)
npm start
```
*(If you are actively developing and modifying the source code, use `npm run dev` to enable hot-reloading for the frontend and backend).*

> ** IMPORTANT:** Whenever you re-run `setup` or manually edit the config files, you **must restart the server** for the changes to take effect.

---

## Uninstallation & Reset

If you ever need to securely wipe the AI's episodic memory, delete your API keys, and completely remove Nyxora's configuration from your operating system, simply run:

```bash
nyxora uninstall
```

This acts as a master reset switch to return your environment to a clean state.

