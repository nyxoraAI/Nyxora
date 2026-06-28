# ⌨️ CLI Reference

Nyxora comes with a powerful Command Line Interface (CLI) Manager to help you control the background daemon, manage keys, and execute administrative tasks directly from your terminal.

## Usage

```bash
nyxora <command>
```

---

## Daemon Management

### `start`
Start the Nyxora background daemon. This process runs silently in the background, managing the core AI engine, SQLite memory databases, and background scheduling (CRON).
```bash
nyxora start
```

### `stop`
Gracefully terminate the running background daemon.
```bash
nyxora stop
```

### `restart`
Restarts the daemon. Useful if you manually edited configuration files and need the engine to reload them into memory.
```bash
nyxora restart
```

### `autostart`
Configure Nyxora to automatically launch when your operating system boots.
```bash
# Enable autostart
nyxora autostart enable

# Disable autostart
nyxora autostart disable
```

---

## Core Interfaces

### `dashboard`
Automatically opens the local web dashboard (Graphical User Interface) in your default internet browser.
```bash
nyxora dashboard
```

### `chat`
A minimalist, terminal-based interactive chat interface. If you prefer to stay in the terminal rather than using the web dashboard, this command lets you converse with the Nyxora AI directly.
```bash
nyxora chat
```

### `mcp`
Start the Universal MCP (Model Context Protocol) Server directly in the foreground. This is strictly intended for developers who need to test or debug the MCP integration without running the full background daemon.
```bash
nyxora mcp
```

---

## Configuration & Security

### `setup`
Run the interactive Setup Wizard. This allows you to configure your primary LLM providers (e.g. OpenAI, DeepSeek), enable/disable Web3 autonomous skills, and configure Web Search plugins.
```bash
nyxora setup
```

### `set-key`
Securely add or overwrite an API Key directly into your Operating System's Native Keyring (bypassing plaintext files).
```bash
nyxora set-key <provider> <key>

# Example:
nyxora set-key openai sk-proj-...
```

**Supported Providers:**

*Language Models (LLMs)*
- `openai`: OpenAI GPT-4/GPT-3.5
- `gemini`: Google Gemini
- `openrouter`: OpenRouter API
- `groq`: Groq High-Speed API
- `mistral`: Mistral AI
- `xai`: xAI Grok
- `deepseek`: DeepSeek

*Search Engines*
- `tavily`: Tavily AI Search
- `brave`: Brave Search

*Integrations*
- `twitter`: X/Twitter API
- `notion`: Notion API
- `github`: GitHub API

*(Note: Custom or unlisted providers will automatically be saved with a `_key` suffix, e.g., `nyxora set-key anthropic sk-xxx` becomes `anthropic_key`).*

### `wallet`
Manage your underlying Web3 wallet and EVM Private Key integration.
```bash
nyxora wallet update
```

### `unlock`
If your dashboard session goes idle and auto-locks, running this command from the terminal acts as an authoritative bypass, instantly unlocking your session.
```bash
nyxora unlock
```

---

## Maintenance & Diagnostics

### `doctor`
Run deep system diagnostics. This checks OS compatibility, missing dependencies, checks for zombie Unix Domain Sockets (`/tmp/nyxora-*.sock`), and validates port availability (Port 3000 & 3001).
```bash
nyxora doctor
```

### `clear`
Atomically wipes the AI's episodic SQLite database (`episodic.db`). Use this if you want the Honcho Daemon to "forget" past conversations, personas, and learned trading preferences.
```bash
nyxora clear
```

### `clean-logs`
Clears the background daemon's system and execution logs, saving disk space.
```bash
nyxora clean-logs
```

### `uninstall`
The master reset command. It completely uninstalls Nyxora's state by wiping the memory database, securely deleting all API and Private keys from the OS Keyring, and deleting the `~/.nyxora` configuration directory.
```bash
nyxora uninstall
```

---

## Global Options
- `-v`, `--version`: Show the current installed version of Nyxora.
- `-h`, `--help`: Show the help menu directly in the terminal.
