# 🪙 Chain Specifics

Nyxora's core engine is designed to be highly interoperable. While the initial release focuses heavily on the Ethereum Virtual Machine (EVM) ecosystem due to its immense liquidity and developer adoption, the architecture is built to eventually support diverse Virtual Machines.

Here is the current state of blockchain support in Nyxora.

---

## 🟢 Fully Supported Networks (EVM)

Nyxora currently has 100% native support for the following EVM-compatible networks. The agent can seamlessly read balances, transfer assets, swap tokens, and check security across any of these chains.

1.  **Ethereum Mainnet (`ethereum`)**
    - The gold standard. Fully supported for all DeFi operations.
2.  **Base (`base`)**
    - Coinbase's L2. Highly recommended for low-fee AI trading operations.
3.  **Arbitrum One (`arbitrum`)**
    - Supported natively. Perfect for high-speed DEX routing.
4.  **OP Mainnet (`optimism`)**
    - Supported natively for fast Layer 2 interactions.
5.  **Polygon Matic (`polygon`)**
    - Fully supported. Nyxora natively recognizes MATIC, POL, and bridged assets.
6.  **BNB Smart Chain (`bsc`)**
    - Supported for low-cost swaps and BEP-20 token management.
7.  **Sepolia Testnet (`sepolia`)**
    - Supported for developers to test their AI Agent strategies without spending real money. *(Note: Security scanning via GoPlus is disabled on Testnets).*

> [!TIP]
> Nyxora uses a dynamic `SUPPORTED_CHAIN_NAMES` registry. If you want to add a new EVM chain (e.g., Avalanche or Linea), you only need to add it to `packages/core/src/web3/config.ts`. The rest of the AI's logic will automatically adapt!

---

## 🟡 Non-EVM Networks (Roadmap v2)

The Web3 ecosystem is vastly expanding beyond EVM. Nyxora is actively developing a **Multi-VM Architecture** to support high-throughput, non-EVM chains. 

These networks are currently **NOT** supported natively in the current version, but are slated for the `v2.x.x` release:

*   **Solana (SVM)**
    *   *Status: In Development.*
    *   *Architecture:* Requires a Dual-Vault System for Ed25519 keypairs and `@solana/web3.js` provider abstraction. DEX routing will utilize Jupiter Aggregator instead of Uniswap routers.
*   **Aptos & Sui (MoveVM)**
    *   *Status: Planned.*
    *   *Architecture:* Will require integration with the Move Virtual Machine RPC standards and Ed25519 signature schemes.

If you desperately need to interact with Solana or Aptos *today*, you can achieve this by creating a [Custom External Skill](/guide/custom_skills) that uses their respective SDKs, though you will need to pass the private key to the sandbox manually (not recommended for production).
