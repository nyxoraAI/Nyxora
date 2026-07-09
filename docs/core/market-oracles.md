# ⚙️ Market Oracles Configuration (Optional)

By default, Nyxora's **Market Intelligence** and price fetching capabilities operate fully without requiring any configuration. However, for advanced users or high-frequency traders, configuring Private API Keys is highly recommended.

## 🔀 Public vs. Private API Routing

Nyxora is built with a **Cascading Oracle Fallback** system. Here is how the system handles data requests:

### 1. Free Public Routing (Default)
If you do not provide any API Keys, Nyxora will route all market intelligence queries (such as price lookups, FDV, and Smart Money Flow) directly to the **Free Public API** endpoints of providers like CoinGecko and DexScreener.
* **Pros**: Works instantly right out of the box (Zero Configuration).
* **Cons (Risks)**: Public endpoints are highly susceptible to **Rate Limits**. If you, or the public IP address you are using, make too many requests in a short period (e.g., analyzing a portfolio with dozens of coins simultaneously), the data provider will temporarily block the requests (Error 429).

### 2. Private API Routing (Pro)
By registering and entering a paid or private API key (such as a **CoinGecko Pro API Key** or **CoinMarketCap Pro**), Nyxora will completely bypass the public limits.
* **Maximum Speed**: Data is fetched through a dedicated pipeline without public queue bottlenecks.
* **Rate Limit Immunity**: Nyxora can perform mass scans on hundreds of Smart Contracts in seconds without fear of being blocked.
* **Real-Time Data**: Certain providers (like CoinGecko) offer significantly faster data updates (cache refreshes) for Pro users compared to public users.

## ⚙️ How to Configure Oracle Keys

You can set your Private API Keys through the provided graphical interface:

1. Open your local Nyxora Dashboard.
2. Navigate to the **Market Oracles Configuration** menu on the left sidebar.
3. Enter the API Key you obtained from the data provider (e.g., the CoinGecko dashboard) into the corresponding field.
4. Click **Save**.

::: tip Security Notice (Zero-Trust)
Just like other secret keys, Nyxora **never** transmits your Oracle keys to our external servers. When you click Save, the key is immediately isolated and saved statically to your local hard drive at `~/.nyxora/config/market_keys.yaml`. This key is only transmitted directly (`direct ping`) to the data provider's server when the AI agent requires it.
:::

## 🔸 Key Deletion

If your API Key expires, or you wish to revert to using the Free Public API, simply return to the Dashboard page and click the **Delete** button. The system will automatically purge your key from memory and gracefully fallback to the public routing system.
