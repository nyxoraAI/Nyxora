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

Before any transaction reaches the OS-Native Secure Vault for signing, it must pass through the local **Policy Gatekeeper** (berjalan sebagai layanan mikro terpisah di `packages/policy`). 

Gatekeeper ini berkomunikasi melalui *Hyper-Optimized IPC Unix Socket*. Bahkan jika AI mengalami halusinasi atau diserang melalui *Prompt Injection* dan mencoba mengeksekusi perdagangan yang melanggar pengaturan Anda (misal: mengatur *slippage* 50% padahal batas maksimal Anda 2%), Gatekeeper akan secara fisik mencegat muatan Web3 tersebut. Ia akan langsung menolak transaksi, secara efektif mengunci kekuatan eksekusi AI di dalam batas yang telah Anda tentukan.

Dengan memisahkan pembangkitan bahasa (LLM di Core) dari verifikasi keamanan (*Policy Engine*) dan eksekusi kriptografi (*Signer Vault*), Nyxora mencapai keandalan **Zero-Trust** yang mutlak.

<br>

>  *Note: The rules established in the Policy Engine are enforced at the network/interceptor level, making it mathematically impossible for the AI to bypass them.*
