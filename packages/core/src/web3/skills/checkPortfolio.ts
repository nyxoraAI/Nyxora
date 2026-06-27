import { formatEther, formatUnits } from 'viem';
import { getPublicClient, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { TOKEN_MAP, ERC20_ABI } from '../utils/tokens';
import { safeFetchJson } from '../../utils/httpClient';

const portfolioCache: Record<string, { data: string, timestamp: number }> = {};
const CACHE_TTL = 5000; // 5 seconds TTL

export async function checkPortfolio(chainName: ChainName, address?: `0x${string}`): Promise<string> {
  try {
    const client = getPublicClient(chainName);
    
    let targetAddress = address;
    if (!targetAddress) {
      const { getAddress } = await import('../config');
      targetAddress = (await getAddress()) as `0x${string}`;
    }

    if (!targetAddress) {
      throw new Error('Address is required but could not be resolved from private key.');
    }

    const safeTargetAddress = String(targetAddress || "");
    const cacheKey = `${chainName}:${safeTargetAddress.toLowerCase()}`;
    const now = Date.now();
    if (portfolioCache[cacheKey] && now - portfolioCache[cacheKey].timestamp < CACHE_TTL) {
      return portfolioCache[cacheKey].data + `\n\n*(Cached from ${(now - portfolioCache[cacheKey].timestamp) / 1000}s ago)*`;
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

    // Merge User-Defined Whitelist
    const { getUserTokens } = await import('../../utils/userWhitelistManager');
    const userCustomTokens = getUserTokens(targetAddress, chainName);
    
    for (const tokenAddr of userCustomTokens) {
      if (!tokensToScan.find(t => String(t.address).toLowerCase() === String(tokenAddr).toLowerCase())) {
        tokensToScan.push({ symbol: 'Token', address: tokenAddr as `0x${string}`, isNative: false });
      }
    }

    // Merge Dynamic Trending Whitelist (CoinGecko lists)
    const { getDynamicTokensForChain } = await import('../../utils/dynamicTokenUpdater');
    const dynamicTokens = await getDynamicTokensForChain(chainName);
    for (const dToken of dynamicTokens) {
      if (!tokensToScan.find(t => String(t.address).toLowerCase() === String(dToken.address).toLowerCase())) {
        tokensToScan.push({ symbol: dToken.symbol, address: dToken.address as `0x${string}`, isNative: false });
      }
    }

    let report = `📊 **Portfolio for ${targetAddress} on ${chainName.toUpperCase()}**\n\n`;
    let totalUsdValue = 0;

    // We will do True On-Chain Multicall with Chunking (max 30 tokens / 60 calls per batch)
    const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
    const MULTICALL3_ABI = [{
      inputs: [{ name: 'addr', type: 'address' }],
      name: 'getEthBalance',
      outputs: [{ name: 'balance', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    }] as const;

    const contracts: any[] = [];
    for (const t of tokensToScan) {
      if (t.isNative) {
        contracts.push({ address: MULTICALL3_ADDRESS, abi: MULTICALL3_ABI, functionName: 'getEthBalance', args: [targetAddress as `0x${string}`] });
      } else {
        contracts.push({ address: t.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [targetAddress as `0x${string}`] });
        contracts.push({ address: t.address, abi: ERC20_ABI, functionName: 'decimals' });
      }
    }

    const CHUNK_SIZE = 60; // 30 tokens (2 calls per token)
    const multicallResults: any[] = [];
    
    try {
      // Create a timeout promise for 5 seconds (more tolerant for large portfolios)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('RPC request timed out')), 5000)
      );

      const executionPromise = (async () => {
        for (let i = 0; i < contracts.length; i += CHUNK_SIZE) {
          const chunk = contracts.slice(i, i + CHUNK_SIZE);
          const res = await client.multicall({ contracts: chunk, allowFailure: true } as any);
          multicallResults.push(...res);
        }
      })();

      await Promise.race([executionPromise, timeoutPromise]);
    } catch (e: any) {
      return `⚠️ **${chainName.toUpperCase()} Network is experiencing high latency.**\nThe public RPC failed to respond. Please try again later.`;
    }

    // Map results back to tokens
    let resultIndex = 0;
    const balances = tokensToScan.map((t) => {
      let balanceNum = 0;
      if (t.isNative) {
        const balResult = multicallResults[resultIndex++];
        if (balResult?.status === 'success' && balResult.result) {
          balanceNum = parseFloat(formatEther(balResult.result as bigint));
        }
      } else {
        const balResult = multicallResults[resultIndex++];
        const decResult = multicallResults[resultIndex++];
        if (balResult?.status === 'success' && balResult.result !== undefined && decResult?.status === 'success' && decResult.result !== undefined) {
          balanceNum = parseFloat(formatUnits(balResult.result as bigint, Number(decResult.result)));
        }
      }
      return { ...t, balanceNum };
    });

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
        const data = await safeFetchJson<any>(url);
        if (data.pairs) {
          data.pairs.forEach((p: any) => {
            if (!priceMap[String(p.baseToken.address).toLowerCase()]) {
               priceMap[String(p.baseToken.address).toLowerCase()] = parseFloat(p.priceUsd);
            }
          });
        }
      } catch {}
    }

    for (const b of nonZeroBalances) {
      const lookupAddr = String((b.isNative ? (chainTokens?.WETH || chainTokens?.WBNB) : b.address) || "").toLowerCase();
      const price = priceMap[lookupAddr] || 0;
      const usdValue = b.balanceNum * price;
      totalUsdValue += usdValue;

      const formattedUsd = usdValue > 0 && usdValue < 0.01 ? usdValue.toFixed(4) : usdValue.toFixed(2);
      
      const pnlIndicator = usdValue > 0 ? '🟢' : '⚪';
      report += `${pnlIndicator} **$${b.symbol}** | ${b.balanceNum.toFixed(4)} ${b.symbol} ($${formattedUsd})\n`;
      report += `📈 **PnL:** +0.00% ($0.00) _(Simulation)_\n`;
      report += `🤖 *Analysis:* Asset tracking active. Awaiting historical entry price data.\n\n`;
    }

    report += `\n💰 **Estimated Net Worth: $${totalUsdValue.toFixed(2)}**`;
    
    portfolioCache[cacheKey] = { data: report, timestamp: Date.now() };
    
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
          enum: SUPPORTED_CHAIN_NAMES,
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
