# Comprehensive Installation Guide

Nyxora is designed for a frictionless onboarding experience. We provide a CLI-based Interactive Setup Wizard that guides you from zero to fully operational in minutes.

---

## 🛠️ Prerequisites
Before installing Nyxora, ensure your system meets the following requirements:
1. **Node.js** (Version 18 or higher).
2. A minimum of 2GB RAM.
3. A valid API Key from one of the supported providers (OpenAI, Gemini, Anthropic, OpenRouter, Groq, Mistral, xAI, DeepSeek) or a local Ollama instance.

---

## 💻 Step 1: Installation & Build

Nyxora operates on a Monorepo architecture using NPM Workspaces. Follow these steps to set up the environment:

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

---

## ⚙️ Step 2: Running the Setup Wizard

Once the dependencies are installed and the project is built, run the initialization command:

```bash
npm run setup
```

**Fast API Key Injection (CLI Shortcut):**
If you already ran the setup and just want to quickly add or update an API key without going through the wizard, you can use the `set-key` command:
```bash
npm run set-key <provider> <your_api_key>
# Example: npm run set-key openai sk-proj-...
# Example: npm run set-key tavily tvly-...
```

The interactive command-line wizard will guide you through:
1. **AI Engine Selection:** Choose your primary LLM provider and input your API key securely.
2. **Skill Selection:** Toggle Web3 and OS capabilities (Zero-Trust isolation).
3. **Wallet Setup:** Auto-generate or manually securely input an Ethereum/EVM private key into your OS-Native Keyring.
4. **Integration:** Configure optional integrations like the Telegram Bot.

---

## 🚀 Step 3: Launching the Agent

Nyxora provides two ways to launch the system depending on your needs.

### Option A: Standard Operation
To run Nyxora normally (using the compiled files), use the start command:
```bash
npm run start
```

### Option B: Development Mode (Hot-Reloading)
If you are developing plugins or modifying the dashboard, run the development server with hot-reloading enabled:
```bash
npm run dev
```

Both commands will automatically:
1. Decrypt your keys using your OS Keyring.
2. Boot up the local backend API and Policy Engine.
3. Start the Web Dashboard and provide you with a secure localhost URL and authentication token in the terminal.

Congratulations, your Nyxora Agent is now live and ready for duty!
