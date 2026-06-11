import { ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { resolveToken } from '../utils/tokens';
import { safeFetchJson } from '../../utils/httpClient';

export async function analyzeMarket(chainName: ChainName, tokenAddressOrSymbol: string): Promise<string> {
  try {
    const cleanSymbol = tokenAddressOrSymbol.replace('$', '').toLowerCase();
    
    // 1. Primary Engine: CoinGecko Global
    try {
      const searchData = await safeFetchJson<any>(`https://api.coingecko.com/api/v3/search?query=${cleanSymbol}`);
      const foundCoin = searchData.coins?.find((c: any) => c.symbol.toLowerCase() === cleanSymbol || c.id === cleanSymbol);
        
        if (foundCoin) {
          const coinData = await safeFetchJson<any>(`https://api.coingecko.com/api/v3/coins/${foundCoin.id}`);
          let report = `📈 **Market Analysis for ${coinData.name} (${coinData.symbol.toUpperCase()})** [Global via CoinGecko]\n\n`;
          report += `**Price:** $${coinData.market_data?.current_price?.usd || 0}\n`;
          report += `**Market Cap:** $${Number(coinData.market_data?.market_cap?.usd || 0).toLocaleString()}\n`;
          report += `**24h Volume:** $${Number(coinData.market_data?.total_volume?.usd || 0).toLocaleString()}\n\n`;
          report += `**Price Change:**\n`;
          report += `- 1h:  ${coinData.market_data?.price_change_percentage_1h_in_currency?.usd?.toFixed(2) || 0}% \n`;
          report += `- 24h: ${coinData.market_data?.price_change_percentage_24h?.toFixed(2) || 0}% \n`;
          report += `- 7d:  ${coinData.market_data?.price_change_percentage_7d?.toFixed(2) || 0}% \n\n`;
          report += `**Rank:** #${coinData.market_cap_rank || 'N/A'}\n`;
          return report;
        }
    } catch (e) {
      console.warn("CoinGecko analysis failed, falling back to DexScreener...", e);
    }

    // 2. Fallback Engine: DexScreener Cross-Chain Search
    let query = tokenAddressOrSymbol;
    try {
      const resolved = resolveToken(tokenAddressOrSymbol, chainName);
      if (resolved !== "0x0000000000000000000000000000000000000000") {
        query = resolved; // Use exact address if resolved locally
      }
    } catch (e) {}

    const dexSearchUrl = `https://api.dexscreener.com/latest/dex/search?q=${query}`;
    const data = await safeFetchJson<any>(dexSearchUrl);
    if (!data.pairs || data.pairs.length === 0) {
      return `No market data found for '${tokenAddressOrSymbol}' on CoinGecko or DexScreener across any chain.`;
    }

    let pair = data.pairs.find((p: any) => p.chainId === chainName);
    if (!pair) {
      pair = data.pairs[0]; 
    }

    let report = `📈 **Market Analysis for ${pair.baseToken.name} (${pair.baseToken.symbol})** on ${pair.chainId.toUpperCase()} [Cross-Chain Fallback: DexScreener]\n\n`;
    report += `**Price:** $${pair.priceUsd}\n`;
    report += `**Liquidity (USD):** $${Number(pair.liquidity?.usd || 0).toLocaleString()}\n`;
    report += `**FDV:** $${Number(pair.fdv || 0).toLocaleString()}\n`;
    report += `**24h Volume:** $${Number(pair.volume?.h24 || 0).toLocaleString()}\n\n`;
    report += `**Price Change:**\n`;
    report += `- 5m:  ${pair.priceChange?.m5 || 0}% \n`;
    report += `- 1h:  ${pair.priceChange?.h1 || 0}% \n`;
    report += `- 24h: ${pair.priceChange?.h24 || 0}% \n\n`;
    report += `**DEX:** ${pair.dexId} (${pair.url})\n`;

    return report;
  } catch (error: any) {
    return `Failed to analyze market: ${error.message}`;
  }
}

export const marketAnalysisToolDefinition = {
  type: "function",
  function: {
    name: "analyze_market",
    description: "Fetches live market data (Price, Liquidity, Volume, FDV, Price Change) globally across all chains using CoinGecko and DexScreener.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The blockchain network",
        },
        tokenAddressOrSymbol: {
          type: "string",
          description: "The token symbol (e.g. USDC, PEPE) or contract address to analyze.",
        }
      },
      required: ["chainName", "tokenAddressOrSymbol"],
    },
  },
};
