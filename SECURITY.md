# Nyxora Security Architecture & Threat Model

Nyxora employs an institutional-grade, **Cryptographically Bound Human-in-the-Loop** security model to protect user assets and private keys against compromised LLMs, supply chain attacks, and prompt injections.

---

## 1. Zero-Knowledge LLM Architecture

The core philosophy of Nyxora is **Zero-Knowledge to the LLM**. 

Large Language Models (LLMs) are incredibly powerful reasoning engines, but they are inherently vulnerable to Prompt Injection and hallucinations. Therefore, the LLM must *never* have unilateral access to private keys or the ability to bypass security guardrails.

To achieve this, Nyxora uses a **3-Tier Monorepo IPC (Inter-Process Communication)** architecture:

1. **Core Runtime (Port 3000):** Executes the LLM logic, handles the UI dashboard, and processes chat inputs.
2. **Policy Engine (Port 3001):** A strict middleware that evaluates all transaction requests against hard limits (e.g., `max_usd_per_tx`).
3. **Signer Vault (Unix Socket):** A completely isolated Node.js process that holds the decrypted private keys in memory. It listens exclusively on `/tmp/nyxora-signer.sock`.

### The Security Flow
When the LLM processes a transaction instruction (e.g., swapping tokens), the lifecycle is as follows:

![Nyxora Security Flow](https://raw.githubusercontent.com/perasyudha/Nyxora/main/assets/security-flow.png)

The diagram above illustrates the lifecycle of a transaction initiated from the user interface. Due to Nyxora's layered architecture, the LLM in the Core Runtime acts solely as a planner generating transaction data structures. The actual cryptographic execution and signing are strictly locked and fully controlled by the Policy Engine and Signer Vault after you provide authorization.

> **Performance Note:** Although the multi-layered security flow above appears complex and lengthy, the entire internal verification, IPC communication, and cryptographic signing process is highly optimized and takes only a few **milliseconds (ms)** to complete.

---

## 2. OS-Native Keyring Integration

Nyxora completely eliminates the need for manual "Master Passwords" or custom AES-GCM keystore files by delegating Private Key encryption directly to your Operating System's trusted Keyring.

*   **Linux:** Integrates seamlessly with `Secret Service API / GNOME Keyring` via `libsecret`.
*   **macOS:** Utilizes the native `Keychain Access`.
*   **Windows:** Uses `Windows Credential Manager`.

When the background daemon boots via `nyxora start`, the Signer Vault process reads the Private Key directly from the OS Keyring without requiring human intervention. This ensures the daemon can safely persist across reboots while maintaining institutional-grade encryption at rest.

### Secure Fallback Storage
In headless server environments (e.g., VPS, Docker) where a GUI Keyring is unavailable, Nyxora gracefully falls back to a strictly permissioned `vault.key` file mechanism. This file is programmatically enforced with `chmod 0600` permissions (Read/Write for owner only), preventing access by other system users.

> **Note:** This OS-level keyring protection is strictly reserved for your Web3 Wallet Private Keys. Standard integration credentials (like LLM API Keys or Telegram tokens) are managed separately via the `config.yaml` file for transparent developer access.

---

## 3. Advanced Cryptographic Security

To prevent advanced Man-in-the-Middle (MITM) attacks and UI compromises, Nyxora is adopting the following cryptographic standards:

### Immutable Policy Store & HMAC Verification
The `policy.yaml` file defines your risk tolerance (e.g., daily spend limits). In Nyxora, this is not a regular editable state file.
*   **Immutable Loading:** The Policy Engine verifies the integrity of `policy.yaml` via checksums or HMAC / public-key signatures upon boot.
*   **No Runtime Write-Access:** The LLM Agent process does not have write access to the policy directory.

### Propose vs. Commit Separation
We enforce a strict separation of duties to prevent prompt injection manipulation:
*   `propose_policy_change()`: The AI is restricted to drafting proposals. It cannot alter live security settings.
*   `commit_policy_change()`: Only a Human Operator, authenticated via a backend Challenge Nonce, can commit the proposal to the Policy Engine.

### Cryptographically Bound Approvals
When the UI asks you to approve a transaction or a policy change, you are not simply clicking "OK". 
The backend requires a cryptographic hash:
```javascript
approval_hash = sha256(policy_diff + timestamp + user_id)
```
This ensures that what the human saw on the UI matches exactly what is being executed, preventing the LLM from secretly modifying the payload in transit.

### Anti-Replay Challenge Nonce
Every approval UI prompt utilizes a **Single-Use Challenge Nonce** with a strict expiry time. This mitigates *XSS Token Leaks* and *Replay Attacks*, ensuring that an old approval token cannot be stolen and reused for a malicious transaction later.

---

## 4. Plugin Sandboxing (Node.js VM Isolation)

Community plugins and custom skills are NEVER executed directly at the OS level. Instead, Nyxora creates an airtight **Virtual Machine (VM) Sandbox** in memory. 

To prevent Supply Chain Attacks, the sandbox **permanently blacklists** critical native modules:
*   `fs` (File System): Plugins cannot read or steal local keystore files.
*   `child_process`: Plugins cannot spawn silent background terminals or malicious `curl | bash` supply chain payloads.
*   `os`, `net`, `cluster`: Blocked to prevent network-level exploitation.

## 5. Anti-MEV & Slippage Defense

To protect user funds from front-running and Maximal Extractable Value (MEV) attacks, Nyxora strictly enforces a **Default Slippage Tolerance of 0.5%** for all decentralized exchange (DEX) routing via Li.Fi and Relay.

Unlike typical web3 interfaces that might expose you to unlimited slippage if left unconfigured, Nyxora's backend hardcodes this protection layer into the API payload. 
If an AI agent attempts to execute a swap without explicit slippage instructions, the `swapToken` and `bridgeToken` engines will automatically inject the `0.5%` boundary. 

Users can safely override this limit globally via the Dashboard UI Settings or dynamically via NLP chat commands for specific high-volatility pairs (e.g., "Swap with 10% slippage").

## 6. Reporting Vulnerabilities

If you discover a vulnerability in the Nyxora architecture, please DO NOT open a public issue.
Instead, email the core maintainer directly at **ainyxor@gmail.com**.
