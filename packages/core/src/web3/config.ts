import { createPublicClient, http, PublicClient } from 'viem';
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
  const rpcUrl = config.web3?.rpc_urls?.[chainName];

  // @ts-ignore
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
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
