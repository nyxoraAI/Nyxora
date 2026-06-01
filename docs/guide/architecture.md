# Technical Architecture

Nyxora operates on a highly secure, modular **Monorepo** architecture designed to strictly separate the intelligence (LLM) from the cryptography (Wallet). 

By isolating concerns across three separate processes, Nyxora ensures that even if the AI is manipulated via advanced Prompt Injections, it remains physically impossible for it to steal funds.

---

## The 3-Tier Defense System

![Nyxora Security Flow](/security-flow.png)

When you launch Nyxora via the background daemon (`nyxora start`), the launcher orchestrates three independent Node.js processes that communicate internally.

### 1. Core Runtime (The Brain) - Port 3000
The Core is the front-facing gateway. It serves the Dashboard UI, connects to the Telegram Bot API, and houses the LLM orchestration logic. 
*   **Role:** Analyzes user intent, reads memory, and builds transaction payloads (unsigned drafts).
*   **Limitation:** It does not know your Private Key and cannot sign transactions.

### 2. Policy Engine (The Guard) - Port 3001
The Policy Engine acts as a strict middleware firewall between the Brain and the Vault.
*   **Role:** Receives transaction drafts from the Core. It parses the payload and checks it against immutable rules defined in `policy.yaml` (e.g., maximum daily spend, whitelisted addresses).
*   **Security:** If a transaction exceeds the allowed risk parameters, the Policy Engine drops it immediately.

### 3. Signer Vault (The Safe) - Unix Socket
The Signer Vault is an ultra-secure, isolated process that holds your Private Key in active volatile memory (RAM).
*   **Role:** Receives validated transactions from the Policy Engine, signs them cryptographically, and broadcasts them directly to the Blockchain RPC.
*   **Isolation:** The Signer Vault does not expose any TCP ports. It listens exclusively on an Inter-Process Communication (IPC) Unix Socket (`/tmp/nyxora-signer.sock`). This guarantees that no external network traffic can ever reach the Vault directly.

---

## Background Daemon Lifecycle

Nyxora runs as a true "Local-First" background service, similar to a database daemon or a web server.

### Boot Sequence
1. **OS-Native Key Retrieval:** When the `Signer Vault` boots up, it automatically queries the `GNOME Keyring` (Linux), `Keychain` (macOS), or `Credential Manager` (Windows) to retrieve the Private Key securely.
2. **Token Generation:** The launcher generates a random 64-byte `INTERNAL_AUTH_TOKEN` and passes it to the three processes via environment variables. This ensures the processes only trust communication from each other.
3. **Dashboard Access:** The launcher also writes a session token to `~/.nyxora/auth.token`. When you run `nyxora dashboard`, the CLI reads this token to grant you seamless access to the UI without requiring a password.

### Graceful Shutdown & Zombie Prevention
When you execute `nyxora stop` or `nyxora restart`, the CLI manager sends a `SIGTERM` signal to the process group leader. 

The orchestrator intercepts this signal and performs a cascading cleanup—terminating the Core, Policy, and Signer children precisely, and automatically clearing any stale Unix Sockets to prevent `EADDRINUSE` zombie lockups.

### System Autostart
Nyxora integrates natively with your OS boot sequence using `nyxora autostart enable`.
Instead of relying on clunky `.bashrc` terminal hacks, the CLI generates native OS hooks (e.g., XDG `.desktop` files on Linux or LaunchAgent `.plist` files on macOS), guaranteeing the AI is awake and monitoring your portfolio the moment your computer turns on.
