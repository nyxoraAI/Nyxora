# Signer SDK

**Package:** `@nyxora-sdk/signer`

The Signer SDK manages cryptographic operations and OS-native key storage. It is designed to operate as a separate process, establishing a secure boundary between your private keys, the AI models, and the user interface.

*(Note: While the current stable release operates via Node.js bindings, the upcoming pure Rust-Native iteration is in active development, as detailed in our Roadmap).*

## 🚀 Installation

```bash
npm install @nyxora-sdk/signer
```

## 🛡️ True Air-Gapped Security

In an enterprise deployment, the Signer SDK should be running on a separate, heavily firewalled server (or a hardware enclave). It listens for verified, policy-approved payloads, signs them locally, and returns the raw hex signature.

```typescript
import { OSKeyringVault } from '@nyxora-sdk/signer';

// Initialize the vault (reads encrypted keys from the OS Keyring)
const vault = new OSKeyringVault();

// Unlock the vault using a secure hardware prompt or KMS
await vault.unlock(process.env.KMS_MASTER_KEY);

// Receive an approved payload from the Policy SDK
const approvedTx = receivePayloadFromPolicyServer();

// The Signer SDK executes the signature in a sandboxed memory space
const signedTxHex = await vault.signTransaction(approvedTx);

// Broadcast the signed transaction...
```

Because the `signer-sdk` operates independently, a complete compromise of your Web Server (`core-sdk`) will still leave the attacker entirely unable to extract your private keys!

## ⏳ Transaction Finality & Revert Detection

Unlike standard "Fire-and-Forget" transaction broadcasters, the Nyxora Signer SDK features built-in **Receipt Waiting**:
- **Anti-False-Positive**: After broadcasting, the SDK actively waits for the blockchain to mine the transaction and fetch the receipt (up to a 20-second timeout window).
- **Revert Interception**: If the transaction reverts on-chain (e.g., due to MEV slippage or gas exhaustion), the SDK violently rejects the promise, ensuring the AI never falsely reports a failed transaction as a success.
- **Graceful Timeout**: If network congestion delays confirmation past the 20-second window, the SDK falls back gracefully and reports a `"Pending receipt"` status, preventing upper-layer HTTP timeouts while maintaining accurate tracking.
