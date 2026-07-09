# Autonomous Market Intelligence

The **Market Intelligence** skill empowers Nyxora with expert-level, real-time analytics to assess the risk and health of any crypto asset across multiple ecosystems. Instead of relying purely on large language model approximations, Nyxora uses deterministic math and a sophisticated **Dual-Routing API Waterfall** to aggregate data from Global CEXs, Decentralized Exchanges (DEXs), and On-Chain trackers.

## 🔀 Dual-Routing Engine

To prevent "Ticker Spoofing" (where malicious tokens mimic the ticker of a legitimate large-cap coin on DEXs) and to ensure accurate proxy metrics, Nyxora intelligently routes API queries based on the user's input type:

### 1. Symbol Search (e.g., `$ETH`, `$SOL`)
When querying by a symbol, Nyxora assumes the user is asking for the globally recognized asset. 
* **Primary Route**: Queries **CoinGecko** and **Centralized Exchanges (CEX)** (Binance, KuCoin, MEXC).
* **Benefit**: Ensures that major assets receive 100% accurate global Market Cap (FDV), Volume, and Liquidity data without being misidentified as a micro-cap meme token on a random DEX.
* **Fallback**: Only if the symbol is completely unrecognized by global CEX/CoinGecko APIs will it fallback to DEX tracking.

### 2. Contract Address Search (e.g., `0x...`)
When querying by an exact Contract Address (CA), Nyxora assumes the user is looking for a specific, potentially newly-launched or micro-cap token.
* **Primary Route**: Queries **DexScreener** for real-time, on-chain liquidity pools.
* **Benefit**: Pinpoints the exact token regardless of chain, capturing live decentralized volume and liquidity depth.
* **Momentum Checks**: After resolving the DEX pair, Nyxora attempts to cross-reference the extracted symbol with CEX APIs to see if it has broader market momentum (RSI, MA50).

## 📈 Market Health Score

Nyxora synthesizes the aggregated data into a 0-10 Market Health Score, heavily penalizing high-risk configurations. The report highlights:

1. **Liquidity Risk**: Evaluates the ratio of actual Liquidity to Fully Diluted Valuation (FDV). A low ratio implies the token cannot handle significant sell pressure.
2. **Smart Money Flow**: Checks 7-Day TVL changes (via DefiLlama) and 24h Volume to determine if smart money is accumulating or fleeing.
3. **Holder Concentration**: Evaluates how many tokens are held by the top 10 wallets (Etherscan logic). High concentration flags extreme manipulation risks.
4. **CEX Momentum (Pandas Technical Analysis)**: Analyzes daily K-lines directly using the Python **Pandas** library (`pandas-ta`). It computes deterministic Moving Averages (MA50) and RSI proxies locally within the ML Engine to gauge if the asset is overbought, oversold, or in a healthy uptrend, completely bypassing LLM hallucination risk.

::: tip Why Deterministic Risk Scoring?
LLMs are prone to hallucinating financial advice or misinterpreting raw numbers. By injecting a deterministic 0-10 health score calculated purely by code *before* it reaches the LLM context window, Nyxora acts as a highly disciplined and objective financial analyst.
:::

::: warning Not Financial Advice (NFA)
To ensure compliance and user safety, the Market Intelligence engine automatically instructs the LLM to append a **"Not Financial Advice"** disclaimer at the end of every analysis. This disclaimer is dynamically translated to match the user's native language.
:::
