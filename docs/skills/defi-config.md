# ⚙️ DeFi Configuration (BYOK)

Nyxora is designed as a highly secure, Zero-Trust platform. Therefore, all aggregator secrets (such as API Keys for 1inch, 0x, Relay, etc.) are never stored in the frontend interface nor explicitly in open databases.

Nyxora implements a strictly isolated **Bring Your Own Keys (BYOK)** system.

## How to Configure DeFi API Keys

You can set your private API keys via the **Dashboard > DeFi Configuration**.

On this page, you will find input fields to enter your API keys for various DeFi providers and Meta-Aggregators, including:

- **1inch Network**
- **0x API**
- **LI.FI**
- **Relay Protocol**
- **OpenOcean**
- **KyberSwap**

### Step-by-Step: Obtaining and Installing API Keys

#### 1. Obtaining the Keys
Here is how you can obtain private API keys for the supported Meta-Aggregators:

*   **1inch Network:** Visit the [1inch Developer Portal](https://portal.1inch.dev/), create an account, and generate an API key under the "APIs" section.
*   **0x API:** Go to the [0x Dashboard](https://dashboard.0x.org/), sign up, and create a new Web3 app to reveal your API key.
*   **LI.FI:** Register at the [LI.FI Developer Portal](https://li.fi/) or contact their sales team for a premium API key to bypass public rate limits.
*   **Relay Protocol:** API keys are typically provided to professional partners. Check the [Relay Documentation](https://docs.relay.link/) for authentication options.

*(Note: OpenOcean and KyberSwap currently operate primarily via public endpoints and do not strictly require user-side API keys in Nyxora).*

#### 2. Installing the Keys in Nyxora
Once you have obtained your keys, follow these steps to securely inject them into Nyxora:

1. Open your Nyxora local web dashboard (typically `http://localhost:3000`).
2. Navigate to the **Settings** menu on the left sidebar, then click on the **DeFi Configuration** tab.
3. Paste the respective API keys into the provided input fields.
4. Click the **Save Configuration** button.
5. The backend will immediately encrypt and store them locally, and the UI will mask the inputs to `***********`.

## UI Masking Security Architecture

To protect your API keys from theft by malware, keyloggers, or malicious browser extensions, Nyxora implements **UI Masking**.

1. **Isolated Storage:** When you save an API key in the Dashboard, it is immediately sent to the backend and securely saved into the `~/.nyxora/defi_keys.yaml` file, which is heavily guarded within your local operating system.
2. **Backend Censorship (IS_SET):** When you reload the Dashboard, the backend will never transmit your raw API secret string back to the client. Instead, it only transmits an `"IS_SET"` status.
3. **Redacted UI:** On your screen, populated fields are automatically locked and the text is masked as a string of asterisks (`***********`).

This architecture guarantees that once a secret is injected into Nyxora, it can **never be read back** through any visual interface.

## Benefits of Private API Keys

Although Nyxora supports using DeFi services without API keys (Free Public Routing), registering and using your private API keys provides significant advantages:

*   **Bypass Rate Limits:** Evade strict rate limiting often imposed on free public routes.
*   **Deep Liquidity Access:** Some providers require premium API keys to access maximum liquidity depth, which minimizes slippage.
*   **Execution Priority:** Avoid quote timeouts when the blockchain network is highly congested.
