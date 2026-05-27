# Security Policy

## Supported Versions

Currently, the Nyxora project is in active development. Only the latest commit on the `main` branch is supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please **do not** open a public issue. We take security very seriously.

Instead, please send an email to the repository owner or reach out privately. We will endeavor to respond and provide a patch as quickly as possible.

## Best Practices for Users
When using Nyxora, you are configuring an autonomous agent that has direct access to your injected Web3 Wallet's private key.

1. **Protect Your Keystore**: Your private key is encrypted and stored in `~/.nyxora/keystore.json`. While it is encrypted using `AES-256-GCM`, you must still treat it and your **Master Password** as highly sensitive. NEVER share your `keystore.json` or your Master Password with anyone.
2. **Human-in-the-Loop Verification**: For standard actions, the agent is restricted from making unilateral transactions. Always review the exact details of the transaction when prompted to "Approve" or "Reject" on the Web Dashboard or Telegram Inline Keyboard before confirming.
3. **Limit Order Automation Risk**: If you use the AI to create a **Limit Order** (Take-profit or Cut-loss), the system WILL execute the transaction automatically in the background when the price condition is met. This intentionally bypasses the Human-in-the-Loop verification for speed. Use this feature with caution.
4. **Wallet Generation**: When you ask the AI to create a new wallet, it generates the Private Key and Seed Phrase locally and displays it once. It does NOT save it anywhere. You are responsible for immediately backing up this information.
5. **Use Testnets**: While getting started or testing new skills, ALWAYS use a testnet (e.g., Sepolia) and a wallet containing only testnet funds.
6. **Do Not Share Your `memory.json`**: The agent's memory may contain sensitive conversational data, generated seed phrases, or addresses you've interacted with. Be cautious before sharing the `memory.json` export.
7. **API Keys**: Treat your OpenAI, Gemini, and other LLM provider API keys as highly confidential. Rotate them immediately if you suspect a compromise.
