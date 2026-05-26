import { createPublicClient, createWalletClient, http, PublicClient, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base, bsc, arbitrum, optimism, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import { loadConfig } from '../config/parser';

dotenv.config();

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

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error('PRIVATE_KEY is not set in .env');

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
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error('PRIVATE_KEY is not set in .env');
  return privateKeyToAccount(privateKey).address;
}
