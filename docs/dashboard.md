# 🖥️ Dashboard Security & UX

The Nyxora Dashboard is designed to be a resilient, professional Web3 execution environment. Because the dashboard connects directly to your local Agent and Signer Vault, we have implemented rigorous physical and network-level protections.

## 📌 Zero-Trust Auto-Lock (Physical Protection)

For users running Nyxora locally (non-VPS), the greatest threat vector is physical access—such as leaving a laptop unattended in a public space. 

To mitigate this, Nyxora features a **Zero-Trust Auto-Lock**. After a period of inactivity, the dashboard automatically deploys a glassmorphism blur overlay, instantly hiding all portfolio data, active chats, and transaction states.

### 🖥️ Unlocking the Dashboard
To unlock the dashboard, you cannot simply type a password into the browser (as this would be vulnerable to keyloggers or browser extensions). Instead, you must authorize the unlock locally from your operating system's terminal:

```bash
nyxora unlock
```

This guarantees that anyone attempting to interact with your dashboard must possess physical terminal access to the host machine. (Note: VPS users can disable this timeout in their Dashboard Settings for a permanent workflow).

## ✨ Resilient UI (Offline Reconnect Overlay)

Nyxora's Dashboard uses a global network interceptor to monitor the health of the background daemon. 

If you restart the daemon (`nyxora restart`) or if the connection is unexpectedly lost, the UI will immediately pause and display a pulsing **"Nyxora Daemon Offline"** overlay. This prevents you from executing "ghost" transactions or losing state.

Once the daemon revives, the overlay automatically lifts, seamlessly resuming your workflow exactly where you left off.

## ✨ Bring Your Own Keys (BYOK) & UI Masking

Nyxora supports overriding public endpoints with your own private API keys (e.g., Alchemy, 1inch, KyberSwap, Etherscan). To protect these secrets from malicious browser extensions or accidental screen-sharing leaks, the Dashboard employs **UI Masking**:

1. **Defi Config Isolation:** Keys entered in the DeFi Configuration tab are saved to a separate, isolated YAML file (`defi_keys.yaml`). When the Dashboard requests this configuration, the backend actively censors the actual keys, transmitting only the string `"IS_SET"` to the frontend browser.
3. **Settings Masking:** Keys within the general Web3 settings (like Etherscan and RPC URLs) are rendered using native password masking (`••••••••`). 

This architecture guarantees that once a secret is injected into the backend, it never travels back to the frontend in plain text.

## 🔸 Dynamic Status Metrics (Real-Time Sync)

The Dashboard is designed to be a transparent window into the background daemon's current state. Hardcoded placeholders have been completely eliminated:
*   **Active CRON Jobs:** The Overview page actively polls the `/api/cron` endpoint to display the exact number of recurring background tasks currently registered by the AI Scheduler.
*   **Agent Identity Sync:** If you instruct the AI to change its name via a chat command (e.g., "Change your name to Jarvis"), the backend instantly updates the global `nyxora.config.json` file. This guarantees that your Dashboard UI and Telegram Bot always reflect the AI's latest personality and naming configurations.

## 🛠️ Unified Agent Capabilities (Settings)

To provide a cleaner, more organized user experience, all modular capabilities of the AI have been consolidated under the **Settings ➔ AGENT CAPABILITIES** menu. 
*   **[Skill Store (Playbooks)](/playbooks):** Manage and install Markdown-based Standard Operating Procedures (SOPs).
*   **Web3 Skills:** Configure native blockchain transaction tools.
*   **OS Skills:** Toggle permissions for the AI to interact with your host operating system (file system, command execution).
*   **External Skills:** Manage `agentskills.io` standard code-based plugins and API keys for external services.

This ensures the primary dashboard sidebar remains clutter-free while centralizing all agent configuration into a single logical control panel.

## 🖥️ Policy Engine Dashboard (Hard-coded Firewall)

Nyxora now features a standalone **Policy Engine Dashboard** module within the Settings interface. This is a strict security mechanism that acts as an impenetrable shield, which cannot be bypassed by the LLM agent under any circumstances. Through this dashboard, you can directly configure NLP-based safety rules and transaction spending limits without having to manually edit the `policy.yaml` file.

Its two primary protections are:
1. **Max USD per Transaction:** A hard limit on the maximum fiat value allowed per transaction.
2. **Strict Whitelist Only:** Instantly blocks any transfers or *smart contract* interactions directed to unregistered addresses.

### ⚙️ Manual Whitelist Configuration
Although spending limits and NLP rules can be configured via the Dashboard GUI, to eliminate the risk of UI injection attacks or fatal typos, the Dashboard interface **deliberately does not provide** a text input field for registering wallet addresses (*whitelist*).

Advanced users who wish to use this feature must manually inject approved addresses into the `~/.nyxora/policy.yaml` file (or `policy.yaml` at the root) under the `whitelist:` array.

**Example `policy.yaml` Format:**
```yaml
max_usd_per_tx: 999999999
whitelist_only: true
require_approval: true
custom_llm_rules: []
whitelist: 
  - "0x1234567890abcdef1234567890abcdef12345678"
  - "0xabcdef1234567890abcdef1234567890abcdef12"
```

> [!NOTE]
> Make sure to halt the daemon (`Ctrl+C` or `nyxora stop`) before modifying this YAML file, then restart it to ensure the system ingests the latest configuration securely.

## 🖥️ RPC Dashboard

Nyxora provides an entirely new **RPC Configuration** tab. Through this interface, users can easily switch *endpoints* for Mainnet and Testnet environments transparently. The system is also built with a robust *fallback* mechanism; if the primary RPC node fails, the system will automatically switch to a backup route to ensure the agent remains seamlessly connected to the blockchain.

## 💡 Global Fiat Currency Converter

To simplify portfolio tracking for users from various countries, the Portfolio Dashboard is now integrated with a **Global Fiat Currency Converter**. This feature fetches live exchange rate data from CoinGecko, allowing you to instantly convert and display your total cross-chain crypto wealth into your local fiat currency (such as IDR, EUR, GBP, JPY, etc.) simply by selecting an option from the Settings page.
