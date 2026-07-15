# ⚙️ Custom RPC Configuration

While Nyxora comes pre-configured to use default public Remote Procedure Call (RPC) nodes for all supported blockchains, advanced users executing high-frequency or time-sensitive trades are highly encouraged to configure **Private / Custom RPCs**.

## 🔌 Why Use a Private RPC?

Public RPCs are shared among thousands of users. During times of high network congestion (e.g., a hyped token launch), public nodes often enforce strict **rate limits** or suffer from high latency. This can cause your AI's transaction to drop or fail.

By using a Private RPC, you get a dedicated pipeline to the blockchain, ensuring your transactions are broadcasted with maximum speed and reliability.

---

## 1. How to Get a Private RPC

You can obtain a free or paid Private RPC endpoint from several top-tier infrastructure providers. The process is generally the same across all platforms:

1. **Choose a Provider**: Sign up at [Alchemy](https://www.alchemy.com/), [Infura](https://www.infura.io/), [QuickNode](https://www.quicknode.com/), or [Ankr](https://www.ankr.com/).
2. **Create an App/Project**: In your provider's dashboard, create a new "App" and select your desired network (e.g., Ethereum Mainnet, Base, Arbitrum).
3. **Copy the RPC URL**: Navigate to the API Keys section and copy the `HTTPS` URL. It usually looks like this:
   `https://eth-mainnet.g.alchemy.com/v2/YOUR_PRIVATE_API_KEY`

---

## ⚙️ 2. Installation & Configuration

Nyxora offers two ways to configure your RPC URLs: via the intuitive Web Dashboard, or by manually editing the configuration file.

### 🖥️ Method A: Via Web Dashboard (Recommended)

1. Open your Nyxora Web Dashboard (`nyxora dashboard` for global installation, or `npm run dev` for local source).
2. Navigate to the **Settings** or **Networks** tab in the sidebar.
3. Select the specific blockchain (e.g., Ethereum).
4. Paste your newly acquired RPC URL into the **Custom RPC** field and hit Save. The daemon will automatically update the configuration without needing a restart.

### 🚀 Method B: Manual File Edit

If you prefer to edit files directly, open your project's configuration file (e.g., `nyxora.config.json` or equivalent setup file) and locate the `web3.rpc_urls` block.

Map the exact chain name (e.g., `ethereum`, `base`, `polygon`) to your RPC URL string:

```json
{
  "web3": {
    "rpc_urls": {
      "ethereum": "https://eth-mainnet.g.alchemy.com/v2/YOUR_PRIVATE_API_KEY",
      "base": "https://mainnet.base.org"
    }
  }
}
```

---

## 3. Multi-RPC Fallback Array (Advanced)

To create an indestructible trading bot, you don't have to rely on a single Private RPC. Nyxora natively supports **Cascading Fallback Arrays**. 

You can provide an *Array* (list) of multiple RPC URLs from different providers for a single chain. If the first RPC goes offline or hits a rate limit, Nyxora will automatically and instantly fall back to the second one!

```json
{
  "web3": {
    "rpc_urls": {
      "ethereum": [
        "https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",
        "https://mainnet.infura.io/v3/YOUR_INFURA_KEY",
        "https://rpc.ankr.com/eth/YOUR_ANKR_KEY"
      ]
    }
  }
}
```

### 📌 The Ultimate Safety Net: Public Auto-Fallback

As a final layer of defense, you never have to manually include public RPCs in your fallback array. Nyxora's core engine (`packages/core/src/web3/config.ts`) is designed to **always append the default public RPC as the last resort**. 

Even if every single custom RPC provider in your array goes completely offline, your transaction will still gracefully failover to the public node.
