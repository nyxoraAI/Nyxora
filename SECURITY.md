# Nyxora Security Architecture & Threat Model

Nyxora employs a **Zero-Trust, Defense-in-Depth Cryptographically Bound Human-in-the-Loop** security model to protect user assets and private keys against compromised LLMs, supply chain attacks, and prompt injections.

---

## 1. Zero-Knowledge LLM Architecture

The core philosophy of Nyxora is **Zero-Knowledge to the LLM**. 

Large Language Models (LLMs) are incredibly powerful reasoning engines, but they are inherently vulnerable to Prompt Injection and hallucinations. Therefore, the LLM must *never* have unilateral access to private keys or the ability to bypass security guardrails.

To achieve this, Nyxora uses a **3-Tier Monorepo IPC (Inter-Process Communication)** architecture:

1. **Core Runtime (Port 3000):** Executes the LLM logic, handles the UI dashboard, processes NLP chat inputs, and utilizes OS/Web2 APIs.
2. **Policy Engine (Unix Socket):** A strict middleware that evaluates all transaction requests against hard limits (e.g., `max_usd_per_tx`, `max_allowed_slippage`). It intercepts traffic via `/tmp/nyxora-policy.sock` to achieve zero-latency internal communication.
3. **Signer Vault (Unix Socket):** A completely isolated Node.js process that holds the decrypted private keys in memory. It listens exclusively on `/tmp/nyxora-signer.sock`.

### The Security Flow
When the LLM processes a transaction instruction, the actual cryptographic execution and signing are strictly locked and fully controlled by the Policy Engine and Signer Vault after you provide authorization.

> **Performance Note:** Although the multi-layered security flow above appears complex and lengthy, the entire internal verification, IPC communication, and cryptographic signing process is highly optimized and takes only a few **milliseconds (ms)** to complete.

---

## 2. On-Chain AI Kill-Switch (Decentralized Registry)

To provide users with absolute, trustless control over their AI agents, Nyxora embeds a core security layer natively on the **Arbitrum Network**.

Before any AI-generated transaction is forwarded to the OS-Native Keyring for signing, the transaction manager invokes an asynchronous RPC call to verify the user's status on the `NyxoraAgentRegistry` Smart Contract. 
If a user suspects their local machine is compromised, they can trigger the `toggleAgentStatus(false)` function via a block explorer (e.g., Arbiscan) from any secure device. The local Gateway process immediately detects this and terminates the execution thread, making it physically impossible for the AI to transmit the payload.

---

## 3. OS-Native Keyring Integration

Nyxora completely eliminates the need for manual "Master Passwords" or custom AES-GCM keystore files by delegating Private Key encryption directly to your Operating System's trusted Keyring.

*   **Linux:** Integrates seamlessly with `Secret Service API / GNOME Keyring`.
*   **macOS:** Utilizes the native `Keychain Access`.
*   **Windows:** Uses `Windows Credential Manager`.

When the background daemon boots via `nyxora start`, the Signer Vault process reads the Private Key directly from the OS Keyring. This ensures the daemon can safely persist across reboots while maintaining robust encryption at rest.

---

## 4. Advanced Cryptographic Security & Sandboxing

### Anti-Replay Challenge Nonce (Nonce Guard)
Every approval UI prompt utilizes a **Single-Use Challenge Nonce** (a randomized 16-byte cryptographic string). The `transactionManager` signs all pending payloads with this Nonce. The `/api/transactions/:id/approve` endpoint strictly enforces matching and immediately marks the Nonce as `used_` upon first validation. This completely eliminates *XSS Token Leaks*, *Double-Spending*, and *Replay Attacks*.

### OS Automation Constraints
By default, Nyxora is a Web3-focused agent. However, users can dynamically grant the AI **System Automation** privileges (e.g., executing shell commands, reading/writing local files) by selecting specific OS capabilities via the `nyxora setup` CLI. Unselected capabilities are strictly blacklisted and quarantined into the `disabled_skills.json` file. This empowers users to build an advanced OS-level assistant while retaining the explicit power to revoke dangerous privileges (like `run_terminal_command`) at any time.

---

## 5. Physical Access & Data Integrity

### Zero-Trust Auto-Lock (Physical Protection)
To protect against unauthorized physical access (e.g., leaving a laptop unattended), the Dashboard implements a **Zero-Trust Auto-Lock** mechanism. After a period of inactivity, the UI aggressively blurs and locks all state. Unlocking the interface requires the user to execute `nyxora unlock` directly from the host operating system's CLI. 

### SQLite WAL Graceful Shutdown (Data Integrity)
To prevent database corruption during abrupt terminations, the Gateway daemon employs deep `SIGTERM` and `SIGINT` interceptors. When a halt is requested, the system safely terminates active incoming API requests and explicitly flushes the SQLite Write-Ahead Logs (WAL) before fully exiting.

---

## 6. Anti-MEV & Slippage Defense

To protect user funds from front-running and Maximal Extractable Value (MEV) attacks, Nyxora operates with a dual-layered slippage system:

1. **Default Slippage (AI Habit):** The baseline slippage (e.g., 0.5%) injected by the AI for standard DEX routing via aggregators.
2. **Max Allowed Slippage (Hard-Limit):** A strict, immutable boundary defined within the NLP Security Policy. If the AI hallucinates or is manipulated into drafting a transaction with an exorbitant slippage parameter (e.g., 50%), the Policy Engine physically intercepts and rejects the payload before it reaches the Signer Vault.

---

## 7. Reporting Vulnerabilities

If you discover a vulnerability in the Nyxora architecture, please DO NOT open a public issue.
Instead, email the core maintainer directly at **ainyxor@gmail.com**.
