# Signer Vault & Master Password

As an autonomous framework capable of executing on-chain asset transfers, **Nyxora** places Private Key protection as its highest absolute priority. We introduced a completely **Isolated Signer Vault**, ensuring that even if the core LLM runtime is compromised via zero-day vulnerabilities, your private keys remain untouchable.

---

## 1. The Isolated Vault Architecture

Nyxora completely isolates the transaction signing process from the LLM execution process.

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
