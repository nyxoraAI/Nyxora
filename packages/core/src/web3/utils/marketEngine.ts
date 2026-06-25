import { ChainName } from './chains';
import { resolveToken } from '../utils/tokens';
import { loadMarketKeys } from '../../config/marketConfigManager';
import { safeFetchJson } from '../../utils/httpClient';

export async function analyzeMarketEngine(chainName: ChainName, tokenAddressOrSymbol: string): Promise<string> {
  const cleanSymbol = tokenAddressOrSymbol.replace('$', '').toLowerCase();
  const keys = loadMarketKeys();

  // Tier 1 & 2: CoinGecko (Pro if key exists, else Public)
  try {
    const isPro = !!keys.coingecko_key;
    const baseUrl = isPro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
    const headers = isPro ? { 'x-cg-pro-api-key': keys.coingecko_key } : undefined;

    const searchData = await safeFetchJson<any>(`${baseUrl}/search?query=${cleanSymbol}`, { headers });
    const foundCoin = searchData.coins?.find((c: any) => c.symbol.toLowerCase() === cleanSymbol || c.id === cleanSymbol);
      
    if (foundCoin) {
      const coinData = await safeFetchJson<any>(`${baseUrl}/coins/${foundCoin.id}`, { headers });
      let report = `📈 **Market Analysis for ${coinData.name} (${coinData.symbol.toUpperCase()})** [Global via CoinGecko ${isPro ? 'Pro' : 'Public'}]\n\n`;
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
    if (keys.cmc_key) {
      console.warn("CoinGecko analysis failed, falling back to CMC...", e.message);
    } else {
      console.warn("CoinGecko analysis failed, falling back to DexScreener...", e.message);
    }
  }

  // Tier 1 & 2: CoinMarketCap (Pro if key exists)
  // Note: CMC doesn't have a truly open public endpoint like CG without keys, 
  // but if the user provided the key, we prioritize it here.
  if (keys.cmc_key) {
    try {
      const data = await safeFetchJson<any>(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${cleanSymbol.toUpperCase()}`, {
        headers: { 'X-CMC_PRO_API_KEY': keys.cmc_key }
      });
      const coin = data.data?.[cleanSymbol.toUpperCase()]?.[0];
      if (coin) {
        let report = `📈 **Market Analysis for ${coin.name} (${coin.symbol})** [Global via CoinMarketCap Pro]\n\n`;
        report += `**Price:** $${coin.quote.USD.price.toFixed(6)}\n`;
        report += `**Market Cap:** $${Number(coin.quote.USD.market_cap).toLocaleString()}\n`;
        report += `**24h Volume:** $${Number(coin.quote.USD.volume_24h).toLocaleString()}\n\n`;
        report += `**Price Change:**\n`;
        report += `- 1h:  ${coin.quote.USD.percent_change_1h.toFixed(2)}% \n`;
        report += `- 24h: ${coin.quote.USD.percent_change_24h.toFixed(2)}% \n`;
        report += `- 7d:  ${coin.quote.USD.percent_change_7d.toFixed(2)}% \n\n`;
        report += `**Rank:** #${coin.cmc_rank}\n`;
        return report;
      }
    } catch (e) {
      console.warn("CMC analysis failed, falling back to DexScreener...", e.message);
    }
  }

  // Tier 2: Ultimate Fallback Engine: DexScreener Cross-Chain Search
  let query = tokenAddressOrSymbol;
  try {
    const resolved = resolveToken(tokenAddressOrSymbol, chainName);
    if (resolved !== "0x0000000000000000000000000000000000000000") {
      query = resolved; // Use exact address if resolved locally
    }
  } catch (e) {}

  const dexSearchUrl = `https://api.dexscreener.com/latest/dex/search?q=${query}`;
  try {
    const data = await safeFetchJson<any>(dexSearchUrl);
    if (!data.pairs || data.pairs.length === 0) {
      return `❌ Market Engine Error: The token '${tokenAddressOrSymbol}' does not exist on CoinGecko, CoinMarketCap, or DexScreener across any supported chain. Please inform the user that this token is either not launched, completely dead, or the symbol is incorrect.`;
    }

    let pair = data.pairs.find((p: any) => p.chainId === chainName);
    if (!pair) pair = data.pairs[0]; 

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
