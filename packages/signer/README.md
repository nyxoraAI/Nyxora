# @nyxora/signer-sdk

A secure, isolated cryptographic vault and transaction signer for Web3 AI Agents.

Part of the **Nyxora AI Ecosystem**.

## Overview
`@nyxora/signer-sdk` is designed to securely isolate your AI's private keys. Instead of storing plain-text keys in your application memory or `.env` files, this SDK leverages the **Native OS Keyring** (macOS Keychain, Windows Credential Manager, Linux Secret Service) to encrypt and hold the keys locally.

It operates strictly on an "Approve and Sign" basis, meaning the AI core engine can never extract the raw private key; it can only request transaction signatures.

## Features
- **Zero-Trust Architecture**: The Private Key never leaves the instantiated `NyxoraSigner` memory.
- **Hardware-Level Security**: Uses `@napi-rs/keyring` to store keys securely in the OS Native Keyring.
- **Transaction Dry-Runs**: Automatically simulates and estimates gas via `viem` to prevent failed transactions.
- **Mutex Nonce Management**: Safely handles high-frequency asynchronous transaction streams without nonce collisions.
- **Framework Agnostic**: Can be embedded directly into Express servers, CLI tools, or Discord bots.

## Installation

```bash
npm install @nyxora/signer-sdk
```

## Quick Start

```typescript
import { NyxoraSigner } from '@nyxora/signer-sdk';

async function main() {
  // Initialize the Signer (you can pass custom RPCs if needed)
  const signer = new NyxoraSigner({
    customRpcUrls: {
      arbitrum: 'https://arb1.arbitrum.io/rpc'
    }
  });

  // 1. Unlock the Vault (Automatically pulls from OS Keyring)
  const address = await signer.unlock();
  
  if (!address) {
    console.error("Vault is locked or uninitialized.");
    return;
  }
  
  console.log(`Vault successfully unlocked for Agent: ${address}`);

  // 2. Sign and Broadcast a Transaction
  const txPayload = {
    chainName: 'arbitrum',
    details: {
      txRequest: {
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000', // 0.001 ETH
        data: '0x'
      }
    }
  };

  try {
    const txHash = await signer.signTransaction(txPayload);
    console.log(`Transaction broadcasted successfully! Hash: ${txHash}`);
  } catch (error) {
    console.error(`Transaction failed or rejected:`, error);
  }
}

main();
```

## Fallback Security
If the application is running in a headless server environment (like Docker) where the OS Keyring is unavailable, the SDK will automatically fallback to reading `~/.nyxora/auth/vault.key`.

**Crucially**, if `vault.key` is used, the SDK strictly enforces POSIX file permissions. If the file permissions are broader than `0600` (e.g., readable by other system users), the SDK will aggressively crash to prevent credential theft.
