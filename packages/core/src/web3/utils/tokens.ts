import { ChainName } from '../config';

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  }
] as const;

export const TOKEN_MAP: Record<ChainName, Record<string, `0x${string}`>> = {
  ethereum: {
    ETH: "0x0000000000000000000000000000000000000000",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  },
  arbitrum: {
    ETH: "0x0000000000000000000000000000000000000000",
    WETH: "0x82aF49447D8a07e3bd95BD0d56f352415231c111",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "USDC.E": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
  },
  base: {
    ETH: "0x0000000000000000000000000000000000000000",
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDT: "0xf55BEC9cbd4732f1F4143f647652e924540d9d64"
  },
  optimism: {
    ETH: "0x0000000000000000000000000000000000000000",
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    USDT: "0x94b008aA00579c1307b0EF2c499aD98a8ce58e58"
  },
  bsc: {
    BNB: "0x0000000000000000000000000000000000000000",
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32CD580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955"
  },
  sepolia: {
    ETH: "0x0000000000000000000000000000000000000000",
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle Faucet Sepolia USDC
    USDT: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"  // Common Sepolia USDT
  },
  polygon: {
    MATIC: "0x0000000000000000000000000000000000000000",
    POL: "0x0000000000000000000000000000000000000000",
    WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    WPOL: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  base_sepolia: {
    ETH: "0x0000000000000000000000000000000000000000",
  }
};

export function resolveToken(tokenSymbolOrAddress: string, chainName: ChainName): `0x${string}` {
  if (tokenSymbolOrAddress.startsWith("0x") && tokenSymbolOrAddress.length === 42) {
    return tokenSymbolOrAddress as `0x${string}`;
  }
  
  const symbolUpper = tokenSymbolOrAddress.toUpperCase().trim();
  
  if (["ETH", "MATIC", "POL", "BNB", "AVAX", "NATIVE"].includes(symbolUpper)) {
    return "0x0000000000000000000000000000000000000000";
  }

  const chainTokens = TOKEN_MAP[chainName];
  if (chainTokens && chainTokens[symbolUpper]) {
    return chainTokens[symbolUpper];
  }

  throw new Error(`Token "${tokenSymbolOrAddress}" pada chain ${chainName} tidak ditemukan. Silakan gunakan alamat kontrak langsung (0x...).`);
}

export interface TokenMetadata {
  decimals: number;
  symbol: string;
}

// Bounded LRU Cache to prevent RAM bloat from fake tokens (OOM protection)
const MAX_CACHE_SIZE = 1000;
const tokenMetadataCache = new Map<string, TokenMetadata>();

export async function getTokenMetadata(client: any, tokenAddress: `0x${string}`): Promise<TokenMetadata> {
  // If it's the native token address placeholder
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    return { decimals: 18, symbol: "ETH/BNB/MATIC" }; // Native fallback
  }

  const cacheKey = `${client.chain?.id || 'unknown'}-${tokenAddress.toLowerCase()}`;
  if (tokenMetadataCache.has(cacheKey)) {
    return tokenMetadataCache.get(cacheKey)!;
  }

  // Parallel RPC execution for extreme latency reduction
  const [decimals, symbol] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }).catch(() => 18) as Promise<number>,
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }).catch(() => "TOKEN") as Promise<string>
  ]);

  const metadata: TokenMetadata = { decimals, symbol };

  // Evict oldest (Map iterates in insertion order)
  if (tokenMetadataCache.size >= MAX_CACHE_SIZE) {
    const firstKey = tokenMetadataCache.keys().next().value;
    if (firstKey) tokenMetadataCache.delete(firstKey);
  }
  
  tokenMetadataCache.set(cacheKey, metadata);
  return metadata;
}
