# ⚙️ Etherscan API V2 Configuration

Nyxora uses the **Etherscan API V2 (Unified API)** to securely fetch your deep transaction history (Native & ERC-20) across more than 60 L1 and L2 networks (Ethereum, Base, Arbitrum, BSC, Optimism, Polygon, and their respective Testnets).

Thanks to the V2 architectural upgrade, you **no longer need** multiple API Keys for different networks. Just **one API Key** from your Etherscan account is enough, and the system will intelligently route it across all supported chains simultaneously!

## 🔍 Why Use an Etherscan API Key?

Nyxora comes pre-configured with a public fallback API Key. However, this public key is shared among thousands of users and enforces a very strict rate limit (1 request per 5 seconds). If the rate limit is exceeded, fetching your transaction history may fail.

By configuring your own Private API Key, Nyxora can fetch thousands of historical transactions at lightning speed without being blocked or rate-limited by Etherscan's servers.

## 🔍 How to Get an Etherscan API V2 Key

You can obtain an API Key for free directly from Etherscan. Follow these steps:

1. **Create an Etherscan Account:** Visit [Etherscan.io](https://etherscan.io/register) and register a new account if you don't have one.
2. **Open API Keys Dashboard:** Once logged in, open the profile menu at the top right and click on **API Keys** (or directly access [etherscan.io/myapikey](https://etherscan.io/myapikey)).
3. **Create a New Key:** Click the **"Add"** or **"Create a new API-KEY token"** button.
4. **Name Your Key:** Give your application a name (e.g., `Nyxora V2 Agent`) and click *Continue*.
5. **Copy the API Key:** Copy the newly generated Token (the string of numbers and letters).

> [!TIP] Unified API Magic
> Even though you created this API Key on the Etherscan (Ethereum Mainnet) website, this V2 API Key is **fully valid and functional** across the entire L2 ecosystem like *Base, Arbitrum, Polygon*, etc. You no longer need to create separate accounts on *Basescan* or *Arbiscan*!

## ⚙️ How to Configure the API Key in Nyxora

Once you have your Token:

1. Open the **Nyxora Dashboard** UI.
2. Navigate to the **Settings** tab.
3. Scroll down until you find the input field labeled: **`Etherscan API V2 Key (Unified - All Networks)`**.
4. Paste the Token you just copied into this field.
5. Click the **Save Configuration** button.

Once saved, this key will be instantly injected into your local `config.yaml` file, and Nyxora will be ready to operate at maximum capacity across all networks!
