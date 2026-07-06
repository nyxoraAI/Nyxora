# Daemon & Interface Commands

Nyxora runs as a background process (daemon) and provides multiple interfaces for interaction.

## 🔸 `nyxora start`
Starts the Nyxora daemon in the background, initializing the Core, Policy Engine, and Signer Vault.

```bash
nyxora start
```

## 🔸 `nyxora stop`
Gracefully halts the background daemon, releasing ports and cleanly shutting down active transactions.

```bash
nyxora stop
```

## 🔹 `nyxora restart`
Restarts the daemon process (useful for applying new configuration changes).

```bash
nyxora restart
```

## 🖥️ `nyxora dashboard`
Automatically opens the local web-based React dashboard in your default browser. 

This isn't just a static monitoring tool—**it features a fully interactive, web-based chat interface** allowing you to converse directly with your Nyxora AI Agent. From the dashboard, you can:
* Chat with the LLM to execute Web3 intents (e.g., "Bridge 0.001 ETH to Base").
* View real-time trending tokens and market sentiment.
* Monitor your portfolio balances.
* Configure advanced DeFi settings.

```bash
nyxora dashboard
```

## ⚡ `nyxora chat`
Launches a direct Terminal-based chat interface to interact with the Nyxora AI Agent right from your command line.

```bash
nyxora chat
```
