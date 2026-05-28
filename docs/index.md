---
layout: home

hero:
  name: "Nyxora"
  text: "Secure execution<br>framework for<br>AI-powered<br>onchain agents."
  tagline: "Nyxora enables AI agents to safely interact with wallets, blockchain protocols, and Web3 tools through a modular execution runtime."
  image:
    src: /favicon.svg # Dummy to trigger image slot
    alt: Nyxora Execution
  actions:
    - theme: brand
      text: Launch Agent
      link: /guide/introduction
    - theme: alt
      text: Explore Runtime
      link: /guide/custom_skills

features:
  - title: Execution Sandbox
    details: Restrict autonomous actions with configurable safety policies and permission boundaries.
  - title: Local Key Isolation
    details: Your private keys never leave your machine. AES-256-GCM encrypted local vault.
  - title: Multi-LLM Support
    details: Easily switch between Gemini, OpenAI, OpenRouter, and Ollama.
  - title: Human-in-the-Loop
    details: All write actions require explicit operator confirmation before broadcast.
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
      <h3>🛡️ Secure Local Execution</h3>
      <p>Nyxora runs locally on your machine. We don't host your wallet keys on remote servers, minimizing attack vectors for critical onchain operations.</p>
    </div>
    <div class="why-card">
      <h3>🧩 Plugin Runtime</h3>
      <p>Extend your agent's capabilities dynamically. Our isolated sandbox allows you to safely install third-party plugins without risking private key exposure.</p>
    </div>
    <div class="why-card">
      <h3>🚦 Human Approval Flows</h3>
      <p>Trust but verify. All destructive or financially sensitive transactions are paused and wait for your explicit cryptographic signature before broadcasting.</p>
    </div>
    <div class="why-card">
      <h3>⚡ Multi-Provider Orchestration</h3>
      <p>Don't be locked into a single AI provider. Nyxora's reasoning engine seamlessly routes between OpenAI, Gemini, and local LLMs like Ollama.</p>
    </div>
  </div>
</div>
