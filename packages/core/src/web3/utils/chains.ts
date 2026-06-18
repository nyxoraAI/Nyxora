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
