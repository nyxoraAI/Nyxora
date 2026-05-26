import { createPublicClient, createWalletClient, http, PublicClient, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base, bsc, arbitrum, optimism, sepolia } from 'viem/chains';
import { loadConfig } from '../config/parser';
import { getPrivateKey } from '../utils/state';

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

export function getWalletClient(chainName: ChainName): WalletClient {
  const chain = supportedChains[chainName];
  if (!chain) throw new Error(`Unsupported chain: ${chainName}`);

  const privateKey = getPrivateKey() as `0x${string}`;
  
  const account = privateKeyToAccount(privateKey);

  const config = loadConfig();
  const rpcUrl = config.web3?.rpc_urls?.[chainName];

  // @ts-ignore
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}

export function getAddress() {
  const privateKey = getPrivateKey() as `0x${string}`;
  return privateKeyToAccount(privateKey).address;
}
