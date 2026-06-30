# Understanding Slippage

In the world of Decentralized Finance (DeFi) and when interacting with Nyxora, understanding Slippage is crucial to protect your crypto assets from unexpected price fluctuations and MEV sandwich attacks.

Nyxora divides slippage management into two layers to provide a perfect balance between AI autonomy and absolute security: **Default Slippage** and **Max Allowed Slippage**. You can configure both via the **Settings > DeFi Configuration** page in your Dashboard.

---

## 1. Default Slippage (%)

This is the **standard reference value (habit)** that the AI Agent will use if you do not specify a slippage number in your prompt.

### How it works:
- **Number value (e.g., `0.5`):** Every time you command *"Swap 1 ETH to USDC"*, the AI will always try to execute the transaction with a maximum price slippage target of 0.5%.
- **Set to `auto`:** This is the recommended configuration. The AI will delegate the calculation to the Aggregator's algorithm (such as 1inch or LI.FI). The algorithm will intelligently predict token volatility and determine the most efficient slippage for that exact second.

## 2. Max Allowed Slippage (%)

This is the ultimate layer of defense. **Max Allowed Slippage** is the "Emergency Brake" or **Hard-Limit Security Boundary** strictly enforced by the Policy Engine.

### How it works:
This value is **non-negotiable** by the AI Agent. If you set this value to **`1.0`** (1%), then:
1. If you accidentally prompt *"Swap with 50% slippage"*...
2. Or if the AI hallucinates and tries to manipulate high slippage...
3. Or if there's an unnatural volatility spike in the market...

Before the transaction even touches your Private Key or OS-Native Wallet, Nyxora will **immediately kill (block) the transaction unilaterally**.

### Why is this extremely important?
Often, scam tokens or malicious smart contracts require a slippage above 10% (even up to 99%) to rob all your funds via transaction taxes (honeypots). With *Max Allowed Slippage*, such scenarios are mathematically **impossible** to execute within Nyxora.

---

## Recommended Configuration

For regular users, here is the best setup:
*   **Default Slippage:** `auto` (Let the aggregator figure out the route efficiency).
*   **Max Allowed Slippage:** `2.0` - `5.0` (A logical limit if you frequently trade small-cap/meme coins which are highly volatile, yet still protects you from extreme losses).
