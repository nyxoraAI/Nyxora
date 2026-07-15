# Policy SDK

**Package:** `@nyxora-sdk/policy-sdk`

The Policy SDK is the strict, cryptographic middleware that sits between the AI Brain (`core-sdk`) and the actual Private Keys (`signer-sdk`). It serves as the definitive security layer, guaranteeing that no transaction reaches the Signer unless it passes strict deterministic policies, on-chain registry checks, and cryptographic validations.

## Installation

This package is officially available on NPM.

```bash
npm install @nyxora-sdk/policy-sdk
```

## Quick Start

The SDK exports the `createPolicyEngine` factory function, which generates a fully-configured Express application instance.

```typescript
import { createPolicyEngine } from '@nyxora-sdk/policy-sdk';
import express from 'express';

// Initialize the Policy Engine
const policyApp = createPolicyEngine({
  jwtSecret: 'YOUR_SECURE_JWT_SECRET', // Optional: Auto-loads from runtime.token if omitted
  signerPort: 3002,                    // Optional: TCP Port for Windows (fallback)
  signerSocket: '/tmp/nyxora-signer.sock' // Optional: UDS Socket for Linux/Mac
});

// Start the server
policyApp.listen(3001, () => {
  console.log('🛡️ Policy Engine is actively guarding transactions on port 3001');
});
```

## Core Features & Security Rules

### 1. Dynamic Rule Enforcement (`policy.yaml`)
The engine continuously watches a local `policy.yaml` file (via `chokidar`) and hot-reloads security parameters without requiring a restart. Supported rules include:
- `max_usd_per_tx`: Hard cap on transaction value.
- `whitelist_only`: Enforces strict destination address filtering.
- `require_approval`: Queues transactions in a pending state until cryptographic approval is provided.

### 2. Cross-Platform IPC (Unix Sockets & TCP)
The SDK transparently routes transaction requests to the Signer SDK using the most secure Inter-Process Communication (IPC) available:
- **Linux/macOS**: Defaults to Unix Domain Sockets (`/tmp/nyxora-signer.sock`) to prevent local port sniffing.
- **Windows**: Automatically falls back to localized TCP (`127.0.0.1:3002`).

### 3. API Endpoints
The configured Express application exposes the following strictly-guarded endpoints:
- `GET /address`: Relays the active Web3 address from the Signer.
- `POST /request-tx`: Evaluates a transaction request (`TxRequestSchema`). Validates `max_usd_per_tx`, `whitelist_only`, and internal HMAC signatures.
- `GET /pending-tx`: Returns a list of transactions awaiting human approval.
- `POST /approve-tx/:id`: Consumes a cryptographic challenge nonce to definitively approve a pending transaction and forward it to the Signer.

## Dependency Isolation
Starting with version `v26.7.10+`, the SDK uses dynamic `require()` isolation to gracefully sever TypeScript compilation bounds. This guarantees a clean, lightweight SDK payload that doesn't conflict with your external `viem` or `ox` node modules.
