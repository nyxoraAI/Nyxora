# 🛟 Troubleshooting Guide

Welcome to the Nyxora troubleshooting hub. If your agent encounters issues during boot-up or operation, you will likely find the solution here.

---

## 1. Telegram Integration Fails (ETIMEDOUT)

**Symptoms:**
When starting the agent, you see a red error log in the terminal stating:
`[Telegram] Connection failed (likely blocked by ISP or timeout): request to https://api.telegram.org/... failed`

**Cause:**
Your Internet Service Provider (ISP) or network firewall is blocking access to the Telegram API.

**Resolution:**
- **Option A:** Use a VPN or system-wide Proxy to bypass the ISP block.
- **Option B:** If you do not need Telegram remote control, you can safely ignore this warning. Nyxora's core runtime and Web Dashboard will continue to function normally.

---

## 2. OS Keyring / Vault Locked Errors

**Symptoms:**
The agent fails to start and throws an error related to `@napi-rs/keyring` or `Vault Unlock Failed`.

**Cause:**
Nyxora attempts to securely store your Web3 Private Keys in your Operating System's native credential manager. If you are running Nyxora on a headless Linux server without a GUI (like Ubuntu Server) or an environment without D-Bus/Secret Service, the native keyring will fail.

**Resolution:**
- Nyxora has a built-in **Hybrid Vault Fallback**. If the OS Keyring fails, it will automatically encrypt your keys and store them in a local `.nyxora/api_vault.key` file with strict `0600` permissions. 
- If it still fails, ensure your user has write permissions to the `~/.nyxora` directory.

---

## 3. Web Dashboard Not Updating (Stuck on Old Version)

**Symptoms:**
You updated Nyxora or modified the source code, but the changes do not appear on `http://localhost:3000`.

**Cause:**
Port 3000 serves the **production build** (`dist/` folder) of the dashboard. It does not auto-update when source files are changed.

**Resolution:**
- If you are a developer, access the live hot-reload server at `http://localhost:5173`.
- To update the production dashboard on port 3000, you must rebuild the frontend by running:
  ```bash
  npm run build --workspace=dashboard
  ```

---

## 4. Web Search Rate Limits (Error 429)

**Symptoms:**
The agent states it cannot fetch web results, or you see `429 Too Many Requests` in the Gateway Logs.

**Cause:**
You have exhausted your free tier API limits on Tavily or Brave Search.

**Resolution:**
You do not need to do anything! Nyxora features an **L3 Auto-Failover Architecture**. If your primary search API fails, the agent will automatically fall back to decentralized **SearXNG** instances to ensure 100% search uptime.

---

## 5. Port 3000 Already in Use

**Symptoms:**
`Error: listen EADDRINUSE: address already in use :::3000`

**Cause:**
Another application (like another Node.js project or React app) is already running on port 3000.

**Resolution:**
Stop the other application, or start Nyxora on a different port by setting the environment variable:
```bash
PORT=8080 nyxora
```

---

## 6. Web3 Transactions Failing (ECONNREFUSED on Port 3001)

**Symptoms:**
When you ask the AI to perform a Web3 action (e.g., Transfer, Swap, Bridge), the Gateway Logs output an `ECONNREFUSED` error pointing to `127.0.0.1:3001`, and the transaction is never sent to your Dashboard for approval.

**Cause:**
Nyxora's internal Zero-Trust Policy Server defaults to running on port `3001`. If another background application on your computer is already using port 3001, the Policy Server will fail to start, causing all Web3 mutation skills to lose connection with the approval engine.

**Resolution:**
Nyxora natively supports dynamic port allocation for its internal Policy Server. You can easily instruct the entire system (both the server and all Web3 AI skills) to migrate to a new, empty port by setting the `POLICY_PORT` environment variable.

You can do this by running Nyxora with the variable inline:
```bash
POLICY_PORT=4005 nyxora start
```
Or permanently by adding it to your `~/.nyxora/.env` file:
```env
POLICY_PORT=4005
```
*(All AI Web3 Skills will automatically detect this change and route your transactions to the new port without any code modification.)*

---

*Still facing issues? Feel free to open an issue on our [GitHub Repository](https://github.com/nyxoraAI/Nyxora/issues).*

