# Comprehensive Installation Guide

Nyxora is designed for a frictionless onboarding experience. We provide a CLI-based Interactive Setup Wizard that guides you from zero to fully operational in minutes.

---

## 🛠️ Prerequisites
Before installing Nyxora, ensure your system meets the following requirements:
1. **Node.js** (Version 18 or higher).
2. A minimum of 2GB RAM.
3. A valid API Key from one of the supported providers (OpenAI, Gemini, OpenRouter, Groq, Mistral, xAI, DeepSeek) or a local Ollama instance.

---

## 🚀 Step 1: Global Installation (Recommended)
The easiest and fastest way to use Nyxora is to install it globally via NPM.

### Method 1: Automated Script (Fastest)
You can install Nyxora with a single command using our automated script:

**For Linux & macOS (Bash):**
```bash
curl -fsSL https://nyxoraai.github.io/Nyxora/install.sh | bash
```

**For Windows (PowerShell):**
```powershell
iwr https://nyxoraai.github.io/Nyxora/install.ps1 -useb | iex
```

### Method 2: Manual NPM Install
Alternatively, you can install it manually on any operating system:

```bash
npm install -g nyxora
```



*If you are a developer looking to contribute to the source code, please see the Developer Installation section below.*

---

## 💻 Step 1.5: Developer Installation (From Source)

If you want to run Nyxora locally from the source code, modify its behaviors, or contribute to the repository, follow these steps instead of the global installation.

### 1. Clone the Repository
```bash
git clone https://github.com/nyxoraAI/Nyxora.git
cd Nyxora
```

### 2. Install Dependencies
Nyxora uses NPM Workspaces to manage its Monorepo architecture. Run `npm install` from the root directory to install dependencies for all workspaces at once:
```bash
npm install
```

### 3. Build the Dashboard
The React Dashboard needs to be built before you can start the backend daemon.
```bash
npm run build
```

### 4. Run the Agent Locally
After building, you can start the interactive setup wizard directly from the source code:
```bash
npm run setup
```
To launch the daemon locally (pre-compiled):
```bash
npm start
```
To run in heavy development mode with hot-reloading:
```bash
npm run dev
```

---

## ⚙️ Step 2: Running the Setup Wizard

Once installed, simply run the initialization command:

```bash
nyxora setup
```

**Fast API Key Injection (CLI Shortcut):**
If you already ran the setup and just want to quickly add or update an API key without going through the wizard, you can use the `set-key` command:
```bash
nyxora set-key <provider> <your_api_key>
# Example: nyxora set-key openai sk-proj-...
# Example: nyxora set-key tavily tvly-...
```

This interactive command-line wizard will guide you through the configuration process:

### Stage A: AI Engine & Provider Selection
Choose the brain behind your agent.
- Supported providers include **OpenAI**, **Google Gemini**, **OpenRouter**, **Groq**, **Mistral**, **xAI**, **DeepSeek**, and **Ollama**.
- The wizard features a searchable list of models (e.g., `gpt-4o`, `gemini-2.5-pro`, `deepseek-reasoner`).
- You can also select **"Custom Model"** to manually input a specific model string.
- Enter your Provider's API Key. *This key is securely saved in your local vault.*

### Stage B: Skill Selection (Web3 & OS)
Nyxora operates on a principle of least privilege. You must explicitly grant the agent its capabilities:
- **Web3 Skills:** Toggle capabilities like Token Swapping, Bridging, NFT Minting, or Portfolio Analysis.
- **OS Skills:** Toggle system-level actions like Reading/Writing Files, Web Scraping, or Google Workspace integration.
*(Any unselected skills are injected into a local `disabled_skills.json` blacklist file, preventing the AI from executing them).*

### Stage C: Web Search Configuration (Conditional)
If you enabled the **Smart Web Search** skill, you will be prompted to choose a search provider (**Tavily** or **Brave Search**) and enter its respective API Key.

### Stage D: Default Chain & Wallet Setup
Select your primary network (e.g., Ethereum, Arbitrum, Base, or Sepolia). For your Web3 Wallet, you have three options:
1. **Auto-Generate:** The system generates a fresh Wallet on-screen.
2. **Manual Input:** Securely input your existing Private Key.
3. **Skip:** Skip if you only need off-chain AI capabilities.
*Your Private Key is instantly encrypted and saved directly into your OS-Native Keyring (GNOME Secret Service, macOS Keychain, or Windows Credential Manager).*

### Stage E: Integration Channels (Telegram & Dashboard)
Select how you want to interact with Nyxora. The **Local Web Dashboard** is enabled by default.
If you enable the **Telegram Bot**:
1. Enter your Telegram Bot Token from `@BotFather`.
2. Nyxora will generate a unique 6-digit PIN on your terminal.
3. Send `/auth <PIN>` to your bot via the Telegram app.
4. Nyxora will instantly pair with your device, ensuring only your Chat ID can control the agent.

---

## 💻 Step 3: Launching the Agent

Everything is set! To start using your AI assistant, simply type:

```bash
nyxora start
```

This command will automatically:
1. Automatically decrypt your keys using your OS Keyring.
2. Boot up the local backend server.
3. Automatically open the **Visual Web Dashboard** in your browser.

Congratulations, your Nyxora Agent is now live and ready for duty!
