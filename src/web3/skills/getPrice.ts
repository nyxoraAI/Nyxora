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
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (!data[coinId]) {
      return JSON.stringify({ error: `Could not find price data for ${coinId}` });
    }

    const price = data[coinId].usd;
    const change24h = data[coinId].usd_24h_change;

    return JSON.stringify({
      coin: coinId,
      priceUsd: price,
      change24h: change24h
    });
  } catch (error: any) {
    return JSON.stringify({ error: `Failed to fetch price: ${error.message}` });
  }
}
