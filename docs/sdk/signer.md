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
