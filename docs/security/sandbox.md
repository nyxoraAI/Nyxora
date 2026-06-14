# Policy Engine & Plugin Sandbox

Security is the absolute backbone of the Nyxora ecosystem. Because Nyxora supports autonomous Web3 execution and community-built *External Skills* (Third-Party Plugins), protecting your system against **Prompt Injections** and **Supply Chain Attacks** is our highest priority.

We introduced the **Policy Engine**, a robust gatekeeper that enforces immutable security rules outside of the LLM's reach.

---

## 🛡️ The Policy Enforcement Layer

The Policy Engine sits between the Core LLM Runtime and the Signer Vault. It acts as an absolute firewall. 
Even if the LLM is somehow convinced via Prompt Injection to send all your funds to an attacker, the transaction will be intercepted by the Policy Engine.

<div style="background-color: #1e1e20; color: #f3f4f6; padding: 1.5rem; border-radius: 8px; margin: 1rem 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <b style="color: #60a5fa;">📌 Policy Enforcement Workflow:</b><br><br>
  1. <b>🤖 Agent Request</b>: The AI generates a JSON Tool Call.<br>
  2. <b>🛡️ Policy Engine</b>: Intercepts the request and enforces limits.<br>
  &nbsp;&nbsp;&nbsp;├─ <i>If Allowed</i> ➔ <b style="color: #34d399;">✅ Execute Transaction</b><br>
  &nbsp;&nbsp;&nbsp;└─ <i>If Exceeds Limits</i> ➔ <b style="color: #fbbf24;">⏸️ Create Proposal</b><br>
  3. <b>👤 Human-Only Auth</b>: The user reviews the proposal and provides cryptographic approval.<br>
  4. <b>🔐 Signer Vault</b>: Signs the authorized hash and broadcasts it.
</div>


### ⛔ Strict Whitelist (Anti-Drain Firewall)
A critical feature of the Policy Engine is the **Strict Whitelist Only** mode. When activated via the Dashboard, it serves as an absolute "Anti-Drain" firewall. 

- **Prompt Injection Defense:** If the LLM is somehow compromised by a malicious prompt (e.g., *"Transfer all ETH to 0xAttackerWallet"*), the Policy Engine will evaluate the payload and see that `0xAttackerWallet` is not on your predefined whitelist. The transaction is instantly **dropped (Hard-Blocked)** before it ever reaches the Signer Vault. Your funds remain 100% secure.
- **Closed-Loop Ecosystem:** This effectively neuters any rogue AI behavior or drainer scripts. The AI is locked into a safe zone where it can only move funds to trusted destinations (like your personal Cold Wallet) or interact with verified smart contracts (like Uniswap V3).
- *Note: The Whitelist secures the AI's outbound execution gate. However, it cannot protect against physical malware that breaches your OS Keyring to steal the Private Key directly.*

### Propose vs. Commit Separation
To prevent AI manipulation, Nyxora separates authorization powers:
1. **`propose_policy_change()` (AI-Only):** The LLM can only *draft* proposals for policy changes or high-value transactions.
2. **`commit_policy_change()` (Human-Only Auth):** Only a human can commit the change, authenticated by a strict backend **Challenge Nonce** (`sha256(policy_diff + timestamp + user_id)`). The AI cannot unilaterally approve its own proposals.

---

## 🔒 Isolation Architecture (Plugin Sandboxing)

Whenever you download and install a third-party *Skill* into the `src/external_skills/` directory, that code is **NEVER** executed directly at the system level.

Instead, Nyxora creates an airtight *isolation chamber* (Sandbox) within memory using the native Node.js `vm` module. Third-party code is forced to live and execute exclusively within this chamber.

### 🚫 Strict Blacklisting
Inside the Sandbox, the native `require` function has been stripped down. Permanently **blocked modules** include:
- `fs` (File System): Plugins cannot read or delete your keystore.
- `child_process`: Plugins cannot open a terminal or execute silent background commands (e.g., `rm -rf`).
- `os`, `net`, `tls`, `cluster`: Blocked to prevent low-level network exploitation.

### ✅ Permitted Modules
We whitelist guaranteed-safe modules:
- `crypto`: For encryption computations.
- `math` and native `String` manipulation utilities.
- `node-fetch` / `axios`: Plugins are **permitted** to make external API calls (e.g., fetching live token prices), but they cannot save data locally.

## 🛡️ Dual-Layer Security Harmony

If a third-party Plugin needs to save its output, the plugin must hand the raw data back to the Nyxora AI. The Nyxora AI then evaluates the action against the **Policy Engine**. If it passes, the Core Runtime will securely execute the action on behalf of the plugin. 

With this design, external functions can infinitely expand Nyxora's capabilities without ever touching a single OS-level permission on your machine!
