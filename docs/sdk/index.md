# Nyxora SDK Framework

Welcome to the **Nyxora SDK Framework**. Nyxora is distributed not just as a monolithic daemon, but as a highly modular, 3-Tier Software Development Kit (SDK).
This architecture allows developers to build autonomous Web3 AI applications with strong local security boundaries, perfectly mirroring our Zero-Trust philosophy.
> [!WARNING]
> **FUTURE ROADMAP FEATURE**
> The 3-Tier Distribution and the packages listed below are currently under active Research & Development (R&D). With the exception of the **Signer SDK** and **Policy SDK**, they are **not yet available** for public installation via NPM. This documentation serves as an architectural preview of Nyxora's future direction.

## 🏗️ The 3-Tier Architecture

Nyxora's SDK is split into 3 distinct packages, allowing you to build true Microservices:

1. **`@nyxora-sdk/core-sdk`**: The AI "Brain" for NLP and API execution.
2. **`@nyxora-sdk/policy-sdk`**: The rigid security middleware. *(Already available on NPM)*
3. **`@nyxora-sdk/signer`**: The low-level, zero-trust cryptographic signer. *(Already available on NPM)*

By splitting your application across these tiers, you can deploy the `core-sdk` on a public-facing server while safely locking the `signer-sdk` deep inside an air-gapped environment.

Choose a package from the sidebar to explore its specific API and usage.
