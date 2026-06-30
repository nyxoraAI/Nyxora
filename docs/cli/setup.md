# Configuration & Setup CLI

Nyxora provides interactive CLI commands to easily configure your environment, APIs, and security keys without manually editing configuration files.

## `nyxora setup`
Launches the interactive setup wizard. This command will guide you through:
1. Setting up your LLM provider (OpenAI, Anthropic, Gemini).
2. Configuring your primary Web3 network.
3. Establishing your local security policies.

```bash
nyxora setup
```

## `nyxora set-key`
Securely add or overwrite an API Key directly into your Operating System's Native Keyring (bypassing plaintext files).

```bash
nyxora set-key <provider> <key>

# Example:
nyxora set-key openai sk-proj-...
```

**Supported Providers:**

*   **Language Models (LLMs)**
    *   `openai`: OpenAI GPT-4/GPT-3.5
    *   `gemini`: Google Gemini
    *   `openrouter`: OpenRouter API
    *   `groq`: Groq High-Speed API
    *   `mistral`: Mistral AI
    *   `xai`: xAI Grok
    *   `deepseek`: DeepSeek
*   **Search Engines**
    *   `tavily`: Tavily AI Search
    *   `brave`: Brave Search
*   **Integrations**
    *   `twitter`: X/Twitter API
    *   `notion`: Notion API
    *   `github`: GitHub API

*(Note: Custom or unlisted providers will automatically be saved with a `_key` suffix, e.g., `nyxora set-key anthropic sk-xxx` becomes `anthropic_key`)*.

---

## `nyxora doctor`
Runs a comprehensive diagnostic check on your local Nyxora installation. 

**What it checks:**
1. OS Keyring accessibility (ensures your vault is functioning).
2. SQLite Database integrity (`episodic.db`).
3. Port conflicts (verifies if Port 3000 is available).
4. Node.js version compatibility.

```bash
nyxora doctor
```
