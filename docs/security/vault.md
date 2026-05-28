# Master Password Vault & Security

As a financial assistant capable of executing on-chain asset transfers, **Nyxora** places Private Key protection as its highest absolute priority. We have designed a Threat Model and cryptographic architecture that eliminates vulnerabilities from both remote attacks and API leaks.

Here are the core defensive pillars of Nyxora:

---

## 1. Zero-Knowledge to the LLM
The greatest risk of AI agents is the possibility of Prompt Injection attacks stealing sensitive data from the AI's context.
In Nyxora, this threat is mitigated to absolute zero:
- **Large Language Models (LLMs) never see, touch, or manage your Private Key.**
- The LLM's only job is to analyze human language (e.g., "Send 1 ETH to Bob") and return structured JSON data containing transaction instructions.
- The actual transaction signing process (converting JSON instructions into broadcast-ready bytes) is performed entirely on your local machine using the `viem` cryptography library, completely out of the AI's reach.

## 2. AES-256-GCM Encryption
Unlike traditional Web3 bots that force you to paste your key in a `.env` file (which is highly vulnerable to scraping scripts), Nyxora does not use `.env` files for wallet keys.

- When you configure your key via the Setup Wizard, Nyxora immediately encrypts it using **AES-256-GCM** (military-grade encryption standard).
- The encryption key is derived directly from the **Master Password** that only you know.
- This encrypted data is wrapped into a blob and stored securely in your local directory at `~/.nyxora/keystore.json`.
- This `keystore.json` file is essentially a block of random numbers to anyone who doesn't know your Master Password.

::: tip VOLATILE MEMORY (RAM-Only)
Every time you restart the Nyxora server (via the `nyxora` command), you will be prompted for your Master Password. Your raw Private Key only resides in active volatile memory (RAM) while the server is running. As soon as the terminal is closed, the key is instantly wiped from RAM.
:::

## 3. Human-in-the-Loop (Absolute Control)
There are no "Ghost Transactions".
Nyxora is programmed to require **explicit human confirmation** for any action that affects your finances (Swaps, Transfers, Bridges, Mints).
Even if the AI model hallucinates or malfunctions, the final execution will freeze until you physically click the **[Approve Transaction]** button on your Web Dashboard or Telegram interface.

## 4. Plugin Sandboxing (Supply Chain Attack Prevention)
As this project grows, the ecosystem of plugins and extended capabilities (such as OS access, file reading, and Terminal execution) will expand.
- To prevent third-party developers from injecting malicious payloads, Nyxora employs **Plugin Sandboxing**.
- Custom skills are **not granted unrestricted access** to the File System (`fs`) or the terminal (`shell`). Access rights are quarantined so the agent can only touch user-approved boundaries (for instance, reading the `/downloads` folder but being strictly blocked from touching `/windows`).
