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
8.  **Arbitrum Sepolia (`arbitrum_sepolia`)**
    - Supported for testing fast L2 routing and cross-chain bridging on Arbitrum testnet.
9.  **Base Sepolia (`base_sepolia`)**
    - Supported for testing Base L2 integrations.
10. **Optimism Sepolia (`optimism_sepolia`)**
    - Supported for testing OP Stack integrations.

> [!TIP]
> Nyxora uses a dynamic `SUPPORTED_CHAIN_NAMES` registry. If you want to add a new EVM chain (e.g., Avalanche or Linea), you only need to add it to `packages/core/src/web3/config.ts`. The rest of the AI's logic will automatically adapt!


