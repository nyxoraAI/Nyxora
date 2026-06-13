# 🌉 Cross-Chain Routing & Bridge Architecture

Nyxora features a dual-engine architecture for handling cross-chain operations (Swaps and Bridges). The system dynamically adjusts its routing strategy based on whether you are executing transactions on **Mainnet** or **Testnet**.

---

## 🏎️ Mainnet Philosophy: Instant Liquidity
When operating on Mainnet ecosystems (e.g., Ethereum L1 to Base L2), users expect instant finality. Therefore, Nyxora bypasses the Native L2 Bridges and delegates operations to **Meta-Aggregators**.

### Aggregator Hierarchy
For cross-chain requests on Mainnet, Nyxora simultaneously queries:
1. **Li.Fi**
2. **Relay Protocol**
3. **KyberSwap**

The aggregator returning the highest expected token output is selected.
* **The Benefit:** Users receive their cross-chain assets in seconds or minutes instead of waiting for the Optimistic Rollup 7-day challenge period. The aggregator's solvers provide the instant liquidity.
* **Same-Chain Swaps:** For same-chain operations, Nyxora additionally includes **1inch** and **0x (Matcha)** in the race to find the absolute best swap rate.

---

## 🛠️ Testnet Sandbox: Native OP Bridge & Autonomy
Testnets (like Base Sepolia or OP Sepolia) often lack deep liquidity on third-party aggregators. To guarantee reliable testing environments, Nyxora falls back to the **Native OP Stack Bridge**.

### How it Works
When bridging from L1 (Sepolia) to L2 (OP Sepolia):
- Nyxora executes a transaction directly against the `L1StandardBridgeProxy`.
- **Zero-LLM Fast Return:** Nyxora immediately returns the L1 Transaction Receipt (Tx Hash) the moment your signature is confirmed on-chain.
- We do not block the UI waiting for the L2 transaction hash. The L2 Sequencer handles the minting asynchronously.

### The 7-Day Challenge & Asynchronous Watcher
When bridging from L2 back to L1, Optimistic Rollups strictly enforce a 7-day *Challenge Period* before funds can be claimed.

To prevent blocking the core engine for a week:
1. Nyxora initializes an **Asynchronous L2 Withdrawal Watcher** (`bridgeWatcher.ts`).
2. The agent saves the transaction state into its memory vault.
3. A background Cron-Job silently monitors the Optimism Portal state.
4. Exactly when the 7-day period expires and the claim becomes valid, the daemon fires a **Telegram Push Notification** to the user containing an inline `[ Approve Claim ]` callback button.

This ensures total zero-trust autonomy without relying on centralized UI platforms to finalize your withdrawals.

---

## 🔍 FAQ

**Q: I bridged to Optimism, why does the Agent show a Sepolia Tx Hash?**
> In OP Stack rollups, a deposit is fundamentally a cross-chain message. You cryptographically sign the transaction on the **Source Chain** (L1). The L1 Smart Contract locks your funds and emits a `TransactionDeposited` event. The **L2 Sequencer** continuously monitors the L1 for this event and *asynchronously* mints the corresponding funds on L2. Nyxora gives you the L1 receipt as proof of deposit.

**Q: Can Relay, KyberSwap, and Li.Fi perform standard swaps?**
> Yes! While they excel at cross-chain bridging, they are fully functional Meta-Aggregators that can perform Same-Chain Swaps. Nyxora utilizes their APIs for both purposes.
