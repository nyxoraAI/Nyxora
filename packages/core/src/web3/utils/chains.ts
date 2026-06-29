import { mainnet, base, bsc, arbitrum, optimism, sepolia, polygon, baseSepolia, arbitrumSepolia, optimismSepolia } from 'viem/chains';

export const supportedChains = {
  ethereum: mainnet,
  base: base,
  bsc: bsc,
  arbitrum: arbitrum,
  optimism: optimism,
  sepolia: sepolia,
  polygon: polygon,
  base_sepolia: baseSepolia,
  arbitrum_sepolia: arbitrumSepolia,
  optimism_sepolia: optimismSepolia,
};

export const SUPPORTED_CHAIN_NAMES = Object.keys(supportedChains);
export type ChainName = keyof typeof supportedChains;

export function normalizeChainName(name: string): ChainName {
  let _c = String(name || "").trim().toLowerCase().replace(/\s+/g, '_');
  if (_c.startsWith('arb_')) _c = _c.replace('arb_', 'arbitrum_');
  else if (_c === 'arb') _c = 'arbitrum';
  else if (_c.startsWith('opt_')) _c = _c.replace('opt_', 'optimism_');
  else if (_c === 'opt') _c = 'optimism';
  else if (_c === 'matic') _c = 'polygon';
  else if (_c === 'eth') _c = 'ethereum';
  else if (_c === 'bnb') _c = 'bsc';
  return _c as ChainName;
}
