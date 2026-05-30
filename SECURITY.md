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

```text
[1] User (Dashboard/Telegram) ──> Sends prompt "Please swap ETH to USDC"
                                      │
[2] Core Runtime (LLM)        <── Understands context & generates JSON Tool Call
                                      │
[3] Policy Engine             <── Receives payload, evaluates rules & limits
                                      │
[4] User (Dashboard/Telegram) <── (If Auth required) Requests Approval (Challenge Nonce)
                                      │
[5] Signer Vault              <── Receives certified instruction from Policy
                                      │
[6] Blockchain RPC            <── Signer Vault signs & broadcasts to RPC
                                      │
[7] User (Dashboard/Telegram) <── Success status returned to chat interface
```

The diagram above illustrates the lifecycle of a transaction initiated from the user interface. Due to Nyxora's layered architecture, the LLM in the Core Runtime acts solely as a planner generating transaction data structures. The actual cryptographic execution and signing are strictly locked and fully controlled by the Policy Engine and Signer Vault after you provide authorization.

> **Performance Note:** Although the multi-layered security flow above appears complex and lengthy, the entire internal verification, IPC communication, and cryptographic signing process is highly optimized and takes only a few **milliseconds (ms)** to complete.

---

## 2. Advanced Cryptographic Security

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

## 3. Plugin Sandboxing

Community plugins and custom skills are executed inside a sandboxed environment.
*   **Restricted FS Access:** Plugins cannot arbitrarily read your `~/.nyxora` keystore directory.
*   **Restricted Shell Exec:** Arbitrary shell commands are disabled for third-party skills to prevent malicious `curl | bash` supply chain payloads.

## 4. Reporting Vulnerabilities

If you discover a vulnerability in the Nyxora architecture, please DO NOT open a public issue.
Instead, email the core maintainer directly at **ainyxor@gmail.com**.
