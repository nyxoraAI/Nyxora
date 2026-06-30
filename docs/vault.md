# OS-Native Keyring Vault

As an autonomous framework capable of executing on-chain asset transfers, **Nyxora** places Private Key protection as its highest absolute priority. In our latest architecture, we have completely eliminated the insecure, manual "Master Password" flow.

Instead, Nyxora operates a completely **Isolated Signer Vault** that securely delegates cryptography to your Operating System's native keyring.

---

## 1. Native OS Keyring Delegation

Unlike traditional bots that force you to paste your key in a `.env` file or use a weak custom password, Nyxora securely injects your wallet directly into the native credential manager of your Operating System via the `@napi-rs/keyring` (Rust N-API) native bindings:

*   **Linux:** Integrates seamlessly with `Secret Service API / GNOME Keyring` via `libsecret`.
*   **macOS:** Utilizes the native `Keychain Access`.
*   **Windows:** Uses `Windows Credential Manager`.

When you run `nyxora setup`, your Private Key is swallowed by the OS and never exposed to the disk in plaintext. 

When the background daemon boots via `nyxora start`, the Signer Vault process requests the key directly from the OS Keyring programmatically. This ensures the daemon can safely run 24/7 in the background across reboots while maintaining robust encryption at rest without human intervention.

## 2. Secure Fallback Mechanism (Headless Servers)

In headless server environments (e.g., VPS, Docker) where a GUI Keyring (like GNOME) is unavailable, the native keyring bindings may fail to load. 

Nyxora anticipates this and gracefully falls back to a strict file-based vault:
*   The fallback file is saved to `~/.nyxora/vault.key` or read via `.env`.
*   **Mandatory Permissions:** Nyxora programmatically enforces `chmod 0600` permissions (Read/Write for owner only). If the permissions are looser, the daemon will refuse to boot, preventing access by other malicious users on the same shared system.

## 3. The Isolated Vault Architecture

Nyxora completely isolates the transaction signing process from the LLM execution process.
*   **Core Runtime (LLM):** Has zero access to memory or disk locations containing private keys.
*   **Policy Engine:** Acts as the middleman firewall. It receives unsigned transaction drafts from the Core.
*   **Signer Vault (Unix Socket):** A completely isolated Node.js process that listens exclusively on a local Unix Socket (`/tmp/nyxora-signer.sock`). 

The raw Private Key only resides in active volatile memory (RAM) within the isolated Signer process. The LLM can never access this memory space.

## 4. Cryptographically Bound Execution

When the UI asks you to approve a transaction, the transmission is not a simple plaintext POST request. 

The backend generates a **Single-Use Challenge Nonce** (a randomized 16-byte cryptographic string). The `transactionManager` cryptographically signs all pending payloads with this Nonce. The `/api/transactions/:id/approve` endpoint strictly enforces Nonce matching and immediately marks the Nonce as `used_` upon first validation. This architecture completely eliminates *Double-Spending*, *XSS Token Leaks*, and *Replay Attacks*, ensuring that an old approval token cannot be stolen and reused for a malicious transaction later.
