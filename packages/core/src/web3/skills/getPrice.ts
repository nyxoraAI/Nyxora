import { safeFetchJson } from '../../utils/httpClient';

export const getPriceToolDefinition = {
  type: "function",
  function: {
    name: "get_price",
    description: "Fetches the current price of a cryptocurrency in USD along with its 24h change percentage.",
    parameters: {
      type: "object",
      properties: {
        coinId: {
          type: "string",
          description: "The CoinGecko ID of the coin (e.g., 'ethereum', 'bitcoin', 'solana')."
        }
      },
      required: ["coinId"]
    }
  }
};

export async function getPrice(coinId: string): Promise<string> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
    const data = await safeFetchJson<any>(url);
    
    if (!data[coinId]) {
      return `❌ Could not find price data for **${coinId.toUpperCase()}**. Please verify the coin name.`;
    }

    const price = data[coinId].usd;
    const change24h = data[coinId].usd_24h_change;
    
    const isPositive = change24h >= 0;
    const arrow = isPositive ? '📈 🟩 +' : '📉 🟥 ';
    const priceFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
    const changeFormatted = change24h ? change24h.toFixed(2) : '0.00';

    return `💰 **Price Update for ${coinId.toUpperCase()}**\n\n` +
           `- **Price (USD)**: \`${priceFormatted}\`\n` +
           `- **24h Change**: ${arrow}${changeFormatted}%`;
  } catch (error: any) {
    return `❌ **Failed to fetch price:** ${error.message}`;
  }
}
