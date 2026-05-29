# Signer Vault & Master Password (v1.5.2)

As an autonomous framework capable of executing on-chain asset transfers, **Nyxora** places Private Key protection as its highest absolute priority. In v1.5.2, we introduced a completely **Isolated Signer Vault**, ensuring that even if the core LLM runtime is compromised via zero-day vulnerabilities, your private keys remain untouchable.

---

## 1. The Isolated Vault Architecture

Nyxora completely isolates the transaction signing process from the LLM execution process.

```mermaid
flowchart LR
    LLM[Core Runtime\nPort: 3000] -->|Propose Tx| Policy[Policy Engine\nPort: 3001]
    Policy -->|IPC (Challenge Nonce)| Socket((Unix Socket\n/tmp/nyxora-signer.sock))
    Socket --> Vault[Signer Vault\nPrivate Keys in RAM]
```

- **Core Runtime (LLM):** Has zero access to memory or disk locations containing private keys.
- **Policy Engine:** Acts as the middleman firewall.
- **Signer Vault (Unix Socket):** A completely isolated Node.js process that listens exclusively on a local Unix Socket (`/tmp/nyxora-signer.sock`). It holds the decrypted private keys in memory.

## 2. AES-256-GCM & In-Memory Volatility
Unlike traditional bots that force you to paste your key in a `.env` file, Nyxora encrypts your wallet using **AES-256-GCM** (military-grade encryption standard) derived from your **Master Password**.

The encrypted payload resides at `~/.nyxora/keystore.json`.

::: tip VOLATILE MEMORY (RAM-Only)
Every time you restart Nyxora, you will be prompted for your Master Password via the CLI or Dashboard UI. 
Your Master Password is sent via the secure IPC Unix Socket to the Signer Vault to unlock the `keystore.json`. The raw Private Key only resides in active volatile memory (RAM) within the isolated Signer process. As soon as the terminal is closed, the Unix Socket is destroyed and the key is instantly wiped from RAM.
:::

## 3. Challenge Nonce Authentication
When you unlock the vault via the Dashboard UI, the transmission of your Master Password is not a simple plaintext POST request. 

The backend generates a **Single-Use Challenge Nonce** with a strict expiry time. Your Dashboard UI must cryptographically bind this nonce to the unlocking request, ensuring that malware extensions or XSS attacks cannot replay an old session token to silently unlock your vault later.
