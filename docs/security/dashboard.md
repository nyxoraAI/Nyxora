# Dashboard Security & UX

The Nyxora Dashboard is designed to be a resilient, professional Web3 execution environment. Because the dashboard connects directly to your local Agent and Signer Vault, we have implemented rigorous physical and network-level protections.

## Zero-Trust Auto-Lock (Physical Protection)

For users running Nyxora locally (non-VPS), the greatest threat vector is physical access—such as leaving a laptop unattended in a public space. 

To mitigate this, Nyxora features a **Zero-Trust Auto-Lock**. After a period of inactivity, the dashboard automatically deploys a glassmorphism blur overlay, instantly hiding all portfolio data, active chats, and transaction states.

### Unlocking the Dashboard
To unlock the dashboard, you cannot simply type a password into the browser (as this would be vulnerable to keyloggers or browser extensions). Instead, you must authorize the unlock locally from your operating system's terminal:

```bash
nyxora unlock
```

This guarantees that anyone attempting to interact with your dashboard must possess physical terminal access to the host machine. (Note: VPS users can disable this timeout in their Dashboard Settings for a permanent workflow).

## Resilient UI (Offline Reconnect Overlay)

Nyxora's Dashboard uses a global network interceptor to monitor the health of the background daemon. 

If you restart the daemon (`nyxora restart`) or if the connection is unexpectedly lost, the UI will immediately pause and display a pulsing **"Nyxora Daemon Offline"** overlay. This prevents you from executing "ghost" transactions or losing state.

Once the daemon revives, the overlay automatically lifts, seamlessly resuming your workflow exactly where you left off.

## Bring Your Own Keys (BYOK) & UI Masking

Nyxora supports overriding public endpoints with your own private API keys (e.g., Alchemy, 1inch, KyberSwap, Etherscan). To protect these secrets from malicious browser extensions or accidental screen-sharing leaks, the Dashboard employs **UI Masking**:

1. **Defi Config Isolation:** Keys entered in the DeFi Configuration tab are saved to a separate, isolated YAML file (`defi_keys.yaml`). When the Dashboard requests this configuration, the backend actively censors the actual keys, transmitting only the string `"IS_SET"` to the frontend browser.
3. **Settings Masking:** Keys within the general Web3 settings (like Etherscan and RPC URLs) are rendered using native password masking (`••••••••`). 

This architecture guarantees that once a secret is injected into the backend, it never travels back to the frontend in plain text.

## Dynamic Status Metrics (Real-Time Sync)

The Dashboard is designed to be a transparent window into the background daemon's current state. Hardcoded placeholders have been completely eliminated:
*   **Active CRON Jobs:** The Overview page actively polls the `/api/cron` endpoint to display the exact number of recurring background tasks currently registered by the AI Scheduler.
*   **Agent Identity Sync:** If you instruct the AI to change its name via a chat command (e.g., "Change your name to Jarvis"), the backend instantly updates the global `nyxora.config.json` file. This guarantees that your Dashboard UI and Telegram Bot always reflect the AI's latest personality and naming configurations.

## Policy Engine (Hard-coded Firewall)

Within the Dashboard Settings interface, there is a strict security mechanism known as the **Policy Engine**. This acts as an impenetrable shield that cannot be overridden by the LLM agent under any circumstances.

Two of its primary protections are:
1. **Max USD per Transaction:** A hard limit on the maximum fiat value allowed per transaction.
2. **Strict Whitelist Only:** Instantly blocks any transfer or smart contract interaction directed at an unlisted address.

### Manual Whitelist Configuration
To eliminate the risk of UI injection attacks or fatal typos, the Dashboard interface intentionally **does not provide** a text input field for wallet addresses.

Advanced users who wish to utilize this feature must manually inject the approved addresses into the `~/.nyxora/policy.yaml` file (or the root `policy.yaml`) under the `whitelist:` array.

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
