# DeFi Configuration (BYOK)

Nyxora is designed as a highly secure, Zero-Trust platform. Therefore, all aggregator secrets (such as API Keys for 1inch, 0x, Relay, etc.) are never stored in the frontend interface nor explicitly in open databases.

Nyxora implements a strictly isolated **Bring Your Own Keys (BYOK)** system.

## How to Configure DeFi API Keys

You can set your private API keys via the **Dashboard > DeFi Configuration**.

Nyxora utilizes a **Dynamic Provider Integration Schema**. The input fields you see on this page are NOT hardcoded. Instead, they are auto-generated dynamically based on the specific `ProviderManifest` of the DeFi Aggregators you currently have installed (such as 1inch, 0x, LI.FI, Relay, etc.). If you install a new provider plugin in the future, its API key requirement will instantly appear here without any UI updates!

### Step-by-Step: Obtaining and Installing API Keys

#### 1. Obtaining the Keys
Here is how you can obtain private API keys for the natively supported Meta-Aggregators:

*   **1inch Network:** Visit the [1inch Developer Portal](https://portal.1inch.dev/), create an account, and generate an API key under the "APIs" section.
*   **0x API:** Go to the [0x Dashboard](https://dashboard.0x.org/), sign up, and create a new Web3 app to reveal your API key.
*   **LI.FI:** Register at the [LI.FI Developer Portal](https://li.fi/) or contact their sales team for a premium API key to bypass public rate limits.
*   **Relay Protocol:** API keys are typically provided to professional partners. Check the [Relay Documentation](https://docs.relay.link/) for authentication options.

*(Note: Some providers like KyberSwap and OpenOcean currently operate primarily via public endpoints and do not strictly require user-side API keys in Nyxora).*

#### 2. Installing the Keys in Nyxora
Once you have obtained your keys, follow these steps to securely inject them into Nyxora:

1. Open your Nyxora local web dashboard (typically `http://localhost:3000`).
2. Navigate to the **DeFi Configuration** menu on the left sidebar.
3. Paste the respective API keys into the dynamically generated input fields.
4. Click the **Save** button next to each key.
5. The backend will immediately encrypt and store them locally, and the UI will mask the inputs to `***********` and tag them as `CONFIGURED`.

## UI Masking Security Architecture

To protect your API keys from theft by malware, keyloggers, or malicious browser extensions, Nyxora implements **UI Masking**.

1. **Isolated Storage:** When you save an API key in the Dashboard, it is immediately sent to the backend and securely saved into the `~/.nyxora/defi_keys.yaml` file, which is heavily guarded within your local operating system.
2. **Backend Censorship (CONFIGURED):** When you reload the Dashboard, the backend will never transmit your raw API secret string back to the client. Instead, it only transmits a `configured: true` boolean state.
3. **Redacted UI:** On your screen, populated fields are automatically locked and the text is masked as a string of asterisks (`***********`) with a green `CONFIGURED` badge.

This architecture guarantees that once a secret is injected into Nyxora, it can **never be read back** through any visual interface.

## Benefits of Private API Keys

Although Nyxora supports using DeFi services without API keys (Free Public Routing), registering and using your private API keys provides significant advantages:

*   **Bypass Rate Limits:** Evade strict rate limiting often imposed on free public routes.
*   **Deep Liquidity Access:** Some providers require premium API keys to access maximum liquidity depth, which minimizes slippage.
*   **Execution Priority:** Avoid quote timeouts when the blockchain network is highly congested.
