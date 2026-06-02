import { createPublicClient, http, fallback, PublicClient, Transport } from 'viem';
import { mainnet, base, bsc, arbitrum, optimism, sepolia } from 'viem/chains';
import { loadConfig } from '../config/parser';

export const supportedChains = {
  ethereum: mainnet,
  base: base,
  bsc: bsc,
  arbitrum: arbitrum,
  optimism: optimism,
  sepolia: sepolia,
};

export type ChainName = keyof typeof supportedChains;

export function getPublicClient(chainName: ChainName): PublicClient {
  const chain = supportedChains[chainName];
  if (!chain) throw new Error(`Unsupported chain: ${chainName}`);

  const config = loadConfig();
  const customRpcRaw = config.web3?.rpc_urls?.[chainName];
  
  const transports: Transport[] = [];
  
  if (customRpcRaw) {
    if (Array.isArray(customRpcRaw)) {
      customRpcRaw.forEach(url => {
        if (url.trim()) transports.push(http(url.trim()));
      });
    } else if (typeof customRpcRaw === 'string' && customRpcRaw.trim()) {
      transports.push(http(customRpcRaw.trim()));
    }
  }
  
  // Fallback public RPCs (Top tier from Chainlist.org prioritized)
  if (!customRpcRaw) {
    if (chainName === 'ethereum') {
      transports.push(http('https://ethereum-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://eth.llamarpc.com', { timeout: 5000 }));
      transports.push(http('https://rpc.ankr.com/eth', { timeout: 5000 }));
    } else if (chainName === 'bsc') {
      transports.push(http('https://bsc-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://bsc-dataseed.binance.org', { timeout: 5000 }));
    } else if (chainName === 'base') {
      transports.push(http('https://base-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://mainnet.base.org', { timeout: 5000 }));
    } else if (chainName === 'arbitrum') {
      transports.push(http('https://arbitrum-one-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://arb1.arbitrum.io/rpc', { timeout: 5000 }));
    } else if (chainName === 'optimism') {
      transports.push(http('https://optimism-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://mainnet.optimism.io', { timeout: 5000 }));
    } else if (chainName === 'sepolia') {
      transports.push(http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://rpc.sepolia.org', { timeout: 5000 }));
    }
  }

  // Always append the default public RPC (like cloudflare) as the last resort
  transports.push(http(undefined, { timeout: 5000 }));

  // @ts-ignore
  return createPublicClient({
    chain,
    transport: fallback(transports, { rank: false }),
    batch: {
      multicall: true
    }
  });
}

// Fetch address from Policy API which proxies to Signer
export async function getAddress(): Promise<string> {
  const token = process.env.INTERNAL_AUTH_TOKEN;
  try {
    const res = await fetch('http://127.0.0.1:3001/address', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Vault is locked or unavailable');
    const data = await res.json();
    return data.address;
  } catch (err: any) {
    throw new Error(`Failed to fetch address: ${err.message}`);
  }
}
