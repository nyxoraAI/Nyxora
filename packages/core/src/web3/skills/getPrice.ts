import { safeFetchJson } from '../../utils/httpClient';
import { loadMarketKeys } from '../../config/marketConfigManager';

export const getPriceToolDefinition = {
  type: "function",
  function: {
    name: "get_price",
    description: "Fetches the current price of a cryptocurrency.",
    parameters: {
      type: "object",
      properties: {
        coinId: {
          type: "string",
          description: "The CoinGecko ID of the coin (e.g., 'ethereum', 'bitcoin', 'solana')."
        },
        currency: {
          type: "string",
          description: "The fiat currency to convert to (e.g., 'usd', 'idr', 'eur', 'jpy'). Defaults to 'usd'."
        }
      },
      required: ["coinId"]
    }
  }
};

export async function getPrice(coinId: string, currency: string = 'usd'): Promise<string> {
  try {
    const keys = loadMarketKeys();
    const isPro = !!keys.coingecko_key;
    const baseUrl = isPro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
    const headers = isPro ? { 'x-cg-pro-api-key': keys.coingecko_key } : undefined;

    const cur = String(currency || "").toLowerCase();
    const url = `${baseUrl}/simple/price?ids=${coinId}&vs_currencies=${cur}&include_24hr_change=true`;
    
    const data = await safeFetchJson<any>(url, { headers });
    
    if (!data[coinId]) {
      return `❌ Could not find price data for **${coinId.toUpperCase()}**. Please verify the coin name.`;
    }

    const price = data[coinId][cur];
    const change24h = data[coinId][`${cur}_24h_change`];
    
    const isPositive = change24h >= 0;
    const arrow = isPositive ? '📈 🟩 +' : '📉 🟥 ';
    const priceFormatted = new Intl.NumberFormat(cur === 'idr' ? 'id-ID' : 'en-US', { style: 'currency', currency: cur.toUpperCase() }).format(price);
    const changeFormatted = change24h ? change24h.toFixed(2) : '0.00';

    return `💰 **Price Update for ${coinId.toUpperCase()}**\n\n` +
           `- **Price (${cur.toUpperCase()})**: \`${priceFormatted}\`\n` +
           `- **24h Change**: ${arrow}${changeFormatted}%`;
  } catch (error: any) {
    return `❌ **Failed to fetch price:** ${error.message}`;
  }
}
