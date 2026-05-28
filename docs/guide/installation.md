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

*If you are a developer looking to contribute to the source code, please `git clone` the Nyxora GitHub repository instead.*

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

### Stage E: Master Password
To protect the Private Key you just generated or inputted, you are required to create a **Master Password**.
This password is the key used by the AES-256-GCM algorithm to encrypt your vault. **Do not forget this password!**

---

## 💻 Step 3: Launching the Agent

Everything is set! To start using your AI assistant, simply type:

```bash
nyxora
```

This command will automatically:
1. Prompt you for your Master Password to decrypt your keys.
2. Boot up the local backend server.
3. Automatically open the **Visual Web Dashboard** in your browser.

Congratulations, your Nyxora Agent is now live and ready for duty!
