# Security Policy

## Supported Versions

Currently, the Nyxora project is in active development. Only the latest commit on the `main` branch is supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please **do not** open a public issue. We take security very seriously.

Instead, please send an email to the repository owner or reach out privately. We will endeavor to respond and provide a patch as quickly as possible.

## Best Practices for Users
When using Nyxora, you are configuring an autonomous agent that has direct access to your injected Web3 Wallet's private key.

1. **NEVER commit your `.env` file**. The `.gitignore` in this repository explicitly ignores `.env` files to prevent accidental leakage.
2. **Use Testnets**: While getting started or testing new skills, ALWAYS use a testnet (e.g., Sepolia) and a wallet containing only testnet funds.
3. **Do Not Share Your `memory.json`**: The agent's memory may contain sensitive conversational data or addresses you've interacted with. Be cautious before sharing the `memory.json` export.
4. **API Keys**: Treat your OpenAI, Gemini, and other LLM provider API keys as highly confidential. Rotate them immediately if you suspect a compromise.
