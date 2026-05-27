import { formatEther, formatUnits } from 'viem';
import { getPublicClient, ChainName } from '../config';
import { TOKEN_MAP, ERC20_ABI } from '../utils/tokens';

export async function checkPortfolio(chainName: ChainName, address?: `0x${string}`): Promise<string> {
  try {
    const client = getPublicClient(chainName);
    
    let targetAddress = address;
    if (!targetAddress) {
      const { getAddress } = await import('../config');
      targetAddress = getAddress();
    }

    if (!targetAddress) {
      throw new Error('Address is required but could not be resolved from private key.');
    }

    const tokensToScan: Array<{ symbol: string, address: `0x${string}`, isNative: boolean }> = [
      { symbol: 'Native', address: '0x0000000000000000000000000000000000000000', isNative: true }
    ];

    const chainTokens = TOKEN_MAP[chainName];
    if (chainTokens) {
      for (const [sym, addr] of Object.entries(chainTokens)) {
        if (addr !== "0x0000000000000000000000000000000000000000") {
          tokensToScan.push({ symbol: sym, address: addr as `0x${string}`, isNative: false });
        }
      }
    }

    let report = `📊 **Portfolio for ${targetAddress} on ${chainName.toUpperCase()}**\n\n`;
    let totalUsdValue = 0;

    // We will do Promise.all for balances
    const balancePromises = tokensToScan.map(async (t) => {
      let balanceNum = 0;
      if (t.isNative) {
        const bal = await client.getBalance({ address: targetAddress as `0x${string}` });
        balanceNum = parseFloat(formatEther(bal));
      } else {
        try {
          const [balWei, dec] = await Promise.all([
            client.readContract({
              address: t.address,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [targetAddress as `0x${string}`],
            }) as Promise<bigint>,
            client.readContract({
              address: t.address,
              abi: ERC20_ABI,
              functionName: 'decimals',
            }) as Promise<number>
          ]);
          balanceNum = parseFloat(formatUnits(balWei, dec));
        } catch (e) {
          balanceNum = 0;
        }
      }
      return { ...t, balanceNum };
    });

    const balances = await Promise.all(balancePromises);
    const nonZeroBalances = balances.filter(b => b.balanceNum > 0);

    if (nonZeroBalances.length === 0) {
      return report + `No funds found for standard tokens on this chain. Net Worth: $0.00`;
    }

    // Now fetch prices from Dexscreener
    // Prepare addresses to fetch
    const addressesToFetch = nonZeroBalances.map(b => b.isNative ? (chainTokens?.WETH || chainTokens?.WBNB) : b.address).filter(Boolean);
    
    const priceMap: Record<string, number> = {};
    if (addressesToFetch.length > 0) {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${addressesToFetch.join(',')}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.pairs) {
          data.pairs.forEach((p: any) => {
            if (!priceMap[p.baseToken.address.toLowerCase()]) {
               priceMap[p.baseToken.address.toLowerCase()] = parseFloat(p.priceUsd);
            }
          });
        }
      } catch (e) {}
    }

    for (const b of nonZeroBalances) {
      const lookupAddr = (b.isNative ? (chainTokens?.WETH || chainTokens?.WBNB) : b.address)?.toLowerCase() || "";
      const price = priceMap[lookupAddr] || 0;
      const usdValue = b.balanceNum * price;
      totalUsdValue += usdValue;

      report += `- **${b.symbol}**: ${b.balanceNum.toFixed(4)} (~$${usdValue.toFixed(2)})\n`;
    }

    report += `\n💰 **Estimated Net Worth: $${totalUsdValue.toFixed(2)}**`;
    return report;
  } catch (error: any) {
    return `Failed to check portfolio: ${error.message}`;
  }
}

export const checkPortfolioToolDefinition = {
  type: "function",
  function: {
    name: "check_portfolio",
    description: "Scans the user's wallet for common tokens on a specific chain and calculates their total USD Net Worth (PNL proxy) using live prices.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
          description: "The blockchain network",
        },
        address: {
          type: "string",
          description: "Optional wallet address. If omitted, uses the AI agent's own wallet.",
        }
      },
      required: ["chainName"],
    },
  },
};
