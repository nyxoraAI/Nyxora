# 🖼️ NFT Trading & OpenSea API v2

Nyxora features native NFT market intelligence and automated Seaport trading capabilities powered by **OpenSea API v2**.

This integration allows your AI agent to check real-time NFT collection floor prices, evaluate market volumes, analyze holder statistics, and execute Seaport purchases or listings safely across EVM mainnets.

---

## 🌐 Supported Networks

The NFT Trading engine natively maps and routes OpenSea API v2 requests across the following supported EVM mainnet networks:
*   `ethereum`
*   `polygon`
*   `arbitrum`
*   `optimism`
*   `base`
*   `bsc`
*   `robinhood`

---

## 🔑 Configuring Your OpenSea API Key

To query OpenSea API v2 endpoints without hitting rate limits, you must supply a valid OpenSea API Key:

1. **Via Dashboard / Desktop GUI:**
   - Open **Settings ➔ Market Oracles**.
   - Paste your key in the **OpenSea API Key (`opensea_key`)** field and click **Save**.
2. **Via Backend API:**
   - You can update or query your keys dynamically via `GET/POST /api/market-keys`.
3. **Via YAML Config:**
   - Store your key under `opensea_key` in your market configuration YAML file (`~/.nyxora/config/market_keys.yaml`).

> [!NOTE]
> If your API key is missing or invalid, Nyxora will return actionable HTTP `401 / 403 / 429` error guidance instructing the agent or user on how to configure `opensea_key`.

---

## 🛠️ Native NFT Skills

Nyxora provides three dedicated native skills in the `@nyxora/core` runtime:

### 1. `get_nft_market_stats` (NFT Market Oracle)
*   **Description:** Queries live NFT collection metrics directly from OpenSea API v2.
*   **Data Returned:**
    *   **Floor Price** (in native ETH/token & USD equivalent)
    *   **24h Volume & Sales Count**
    *   **Market Cap & Total Supply**
    *   **Unique Owner Distribution**
*   **Example Prompt:** *"Check the current floor price and 24h volume for Bored Ape Yacht Club on Ethereum."*

### 2. `buy_nft_opensea` (Seaport Fulfillment & Policy Guardrail)
*   **Description:** Constructs and executes an on-chain Seaport NFT purchase from an active OpenSea listing.
*   **How It Works:**
    1. Queries `/api/v2/listings/fulfillment_data` from OpenSea to retrieve official Seaport calldata.
    2. Intercepts the transaction intent through the **Nyxora Policy Gate** (`require_approval`).
    3. Prompts the user for explicit confirmation before signing and broadcasting via the Signer Vault.
*   **Example Prompt:** *"Buy the cheapest floor NFT from Pudgy Penguins on Ethereum."*

### 3. `list_nft_opensea` (Off-Chain Seaport Listing & Auto-Approval)
*   **Description:** Prepares and signs an off-chain Seaport NFT listing order for ERC-721 or ERC-1155 tokens.
*   **Automated Conduit Approval:**
    *   The agent automatically checks if your wallet has enabled `isApprovedForAll` for the official Seaport Conduit (`0x1E0049783F008A0085193E00003D00cd54003c71`).
    *   If approval is missing, the agent drafts an on-chain `setApprovalForAll` transaction first before creating the listing.
*   **Example Prompt:** *"List my ERC-721 NFT 0x123... #4567 on Base for 0.15 ETH."*

---

## 🔒 Guarded Autonomy & Security

All NFT purchases and listing approvals strictly honor your **Policy Engine** configuration:
*   **Spending Limits:** Any NFT buy order exceeding `max_usd_per_tx` is rejected immediately.
*   **Whitelist Protection:** When `whitelist_only: true` is enabled, interacting with unverified or unwhitelisted NFT contracts is blocked at the gateway layer.
