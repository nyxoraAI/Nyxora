# 🏗️ Guarded Autonomy Architecture

This document outlines the operational architecture of Nyxora's "Guarded Autonomy"—an advanced paradigm that balances the free-thinking generative reasoning of the Core LLM and the predictive analytics of the ML Engine with strict, unbreakable Zero-Trust security policies. Operating within a 6-Tier Hybrid Architecture, this system empowers the AI to act autonomously while remaining mathematically confined by the isolated Policy Gatekeeper.

---

## 1. Policy Engine Expansion (Risk Management)

The policy configuration acts as the ultimate risk control center for the system. Instead of simple on/off switches, it defines:
- **User Risk Profiles:** Tolerances for maximum allowed slippage and customized Natural Language (NLP) Rules. These are now dynamically shaped and updated by the asynchronous **Nyx Daemon** based on your conversational history, ensuring the AI's boundaries adapt securely to your changing behavior without manual file edits.
- **Strict Trading Criteria:** User-defined rules (e.g., "Never buy a token if liquidity is below $10,000") that the LLM must obey before attempting to draft a transaction.
- **Guarded Autonomy (Auto-Approve Limits):** A mechanism that allows the agent to auto-execute small micro-trades instantly, while larger or sensitive transactions are automatically held back for explicit human approval via the Dashboard UI.

---

## 2. The Policy Gatekeeper (Transaction Interceptor)

Before any transaction reaches the OS-Native Secure Vault for signing, it must pass through the local **Policy Gatekeeper** (running as a dedicated microservice in `packages/policy`).

The Gatekeeper communicates via a **Hyper-Optimized IPC Unix Socket**. Even if the AI experiences a hallucination or is targeted by a Prompt Injection attack and attempts to execute a trade that violates your safety rules (for example: setting a 50% slippage when your maximum limit is 2%), the Gatekeeper physically intercepts the Web3 payload. It immediately rejects the transaction, effectively confining the AI's execution capabilities within your defined security boundaries.

By separating natural language generation (LLM in Core) from security verification (Policy Engine) and cryptographic signing (Signer Vault), Nyxora achieves absolute **Zero-Trust** reliability.

<br>

>  *Note: The rules established in the Policy Engine are enforced at the network/interceptor level, making it mathematically impossible for the AI to bypass them.*
