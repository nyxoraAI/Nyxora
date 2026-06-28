---
layout: home

hero:
  name: "Nyxora"
  text: "Local-First,<br>Zero-Trust AI Agent<br>for DeFi Automation."
  tagline: "Autonomous on-chain execution without sacrificing self-custody. Powered by an Isolated Signer Vault, OS-native credential storage, and an On-Chain Base Sepolia Kill-Switch."
  image:
    src: /favicon.svg # Dummy to trigger image slot
    alt: Nyxora Execution
  actions:
    - theme: brand
      text: Launch Agent
      link: /guide/introduction
    - theme: alt
      text: Explore Runtime
      link: /guide/architecture

features:
  - title: 🏛️ 3-Tier IPC Architecture
    details: Complete process isolation between Core LLM (port 3000), Policy Engine (Unix Socket), and Signer Vault (Unix Socket).
  - title: 🛡️ Replay Protection & Nonce Guard
    details: UI approvals are strictly cryptographically bound by 16-byte challenge nonces to eliminate Double-Spending and Replay Attacks.
  - title: 🖥️ Resilient UI & Auto-Lock
    details: Features a Zero-Trust Physical Auto-Lock and a robust Offline Reconnect Overlay that seamlessly handles daemon restarts without losing state.
  - title: 🌐 Cross-Chain Hybrid Market Scanner
    details: Real-time asset tracking combining CoinGecko global data with DexScreener on-chain metrics across Ethereum, Base, Solana, and more.
  - title: 🤖 Multi-LLM Support
    details: Easily switch between Gemini, Anthropic, OpenAI, OpenRouter, Ollama, Groq, Mistral, xAI, and DeepSeek, including support for custom model inputs.
  - title: 🧠 Dialectic User Modeling
    details: The internal Honcho Daemon continuously audits chat history to extract and adapt to your trading persona and risk tolerance dynamically.
  - title: 🧩 Autonomous Skill Synthesizing
    details: Tell the AI to learn a new workflow, and it will autonomously write and save a custom modular plugin following the agentskills.io standard.
---

<style>
.why-nyxora {
  max-width: 1152px;
  margin: 64px auto;
  padding: 0 24px;
}
.why-nyxora h2 {
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 48px;
  letter-spacing: -0.02em;
}
.why-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.why-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-bg-soft);
  padding: 24px;
  border-radius: 12px;
  transition: border-color 0.25s;
}
.why-card:hover {
  border-color: var(--vp-c-brand-1);
}
.why-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.why-card p {
  color: var(--vp-c-text-2);
  font-size: 0.95rem;
  line-height: 1.6;
}
</style>

<div class="why-nyxora">
  <h2>Why Nyxora?</h2>
  <div class="why-grid">
    <div class="why-card">
      <h3>🔐 OS-Native Keyring Vault</h3>
      <p>Eliminates vulnerable "Master Passwords" and plaintext <code>.env</code> files. Private keys are encrypted and stored directly within your operating system's trusted Keyring (GNOME Secret Service, macOS Keychain, or Windows Credential Manager).</p>
    </div>
    <div class="why-card">
      <h3>🧩 OS Automation Constraints</h3>
      <p>Empower your agent with OS-level System Automation. Run shell scripts and manage local files dynamically while retaining explicit power to revoke privileges at any time.</p>
    </div>
    <div class="why-card">
      <h3>🚦 Human Approval Flows</h3>
      <p>Trust but verify. All destructive or financially sensitive transactions are paused and wait for your explicit cryptographic signature before broadcasting.</p>
    </div>
    <div class="why-card">
      <h3>⚡ Premium Utility UI</h3>
      <p>A sleek, readable dashboard built for professional Web3 execution. Manage multiple ChatGPT-style isolated chat sessions effortlessly.</p>
    </div>
    <div class="why-card">
      <h3>🛡️ MEV & Slippage Defense</h3>
      <p>Automatically routes trades through MEV-protected aggregators and enforces strict dual-layered slippage hard-limits to block front-running and sandwich attacks.</p>
    </div>
    <div class="why-card">
      <h3>🧠 Dialectic User Modeling</h3>
      <p>Nyxora quietly extracts and learns your Web3 habits in the background. The asynchronous <b>Honcho Daemon</b> continuously audits your chat history to extract your persona and save it to <code>episodic.db</code>, drastically minimizing repetitive user instructions.</p>
    </div>
    <div class="why-card">
      <h3>🧩 agentskills.io Standard</h3>
      <p>Extend Nyxora's capabilities effortlessly. Drop any custom community skill into your local <code>~/.nyxora/skills/</code> directory, or command Nyxora to autonomously code and synthesize a new skill for itself!</p>
    </div>
  </div>
</div>
