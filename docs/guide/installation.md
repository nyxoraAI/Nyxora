# Comprehensive Installation Guide

Nyxora is designed for a frictionless onboarding experience. We provide a CLI-based Interactive Setup Wizard that guides you from zero to fully operational in minutes.

---

## 🛠️ Prerequisites
Before installing Nyxora, ensure your system meets the following requirements:
1. **Node.js** (Version 18 or higher).
2. A minimum of 2GB RAM.
3. A valid API Key from one of the supported providers (Google Gemini AI, OpenAI, or OpenRouter).

---

## 🚀 Step 1: Global Installation

The easiest way to use Nyxora is by installing it globally on your machine. Open your terminal (Command Prompt, PowerShell, or Linux/Mac Terminal) and run:

```bash
npm install -g nyxora
```

*If you are a developer looking to contribute to the source code, please see the Developer Installation section below.*

---

## 💻 Step 1.5: Developer Installation (From Source)

If you want to run Nyxora locally from the source code, modify its behaviors, or contribute to the repository, follow these steps instead of the global installation.

### 1. Clone the Repository
```bash
git clone https://github.com/perasyudha/Nyxora.git
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
To launch the daemon locally:
```bash
npm run start
```
To open the React dashboard locally:
```bash
npm run dashboard
```

---

## ⚙️ Step 2: Running the Setup Wizard

Once installed, there is no need to manually create `.env` files! Simply run the initialization command:

```bash
nyxora setup
```

This command-line wizard will guide you through five simple stages:

### Stage A: LLM Provider Selection
Choose the brain behind your agent.
- We recommend **Google Gemini** or **OpenAI** for the best reasoning capabilities.
- The wizard will auto-populate options like `gemini-2.5-flash` (fast & cheap) or `gpt-4o`.
- You can also select the **"Custom Model"** option if you wish to manually type a specific model name (e.g., local Ollama models).

### Stage B: Entering the API Key
Enter the API Key corresponding to your chosen provider.
*This key will be securely saved in your local configuration vault and will never be exposed.*

### Stage C: Network & Telegram Configuration
Select your default blockchain network (e.g., **Base**, **Ethereum**, or **Sepolia Testnet**). You will also be asked if you want to enable the Telegram bot integration for remote control.

### Stage D: Web3 Wallet Setup
The most crucial part. You have three options:
1. **Auto-Generate (Recommended for Testing):** The system will instantly generate a fresh Ethereum address for you on-screen and securely save its Private Key into the vault.
2. **Manual Input:** Input your own existing Private Key (See [Wallet Import Guide](../security/wallet_import.md)).
3. **Skip:** Skip this stage if you don't need to execute crypto transactions right now.

### Stage E: Keyring Integration
To protect the Private Key you just generated or inputted, Nyxora will securely integrate with your Operating System's native Keyring (macOS Keychain, Windows Credential Vault, or Linux Secret Service).
No manual Master Passwords are required!

---

## 💻 Step 3: Launching the Agent

Everything is set! To start using your AI assistant, simply type:

```bash
nyxora
```

This command will automatically:
1. Automatically decrypt your keys using your OS Keyring.
2. Boot up the local backend server.
3. Automatically open the **Visual Web Dashboard** in your browser.

Congratulations, your Nyxora Agent is now live and ready for duty!
