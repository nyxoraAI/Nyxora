import { ChainName } from '../config';
import { fetchMainnetBestRoute, RouteQuote } from './aggregatorMainnet';
import { fetchTestnetBestRoute } from './aggregatorTestnet';

export async function routeTransaction(
  fromChain: ChainName,
  toChain: ChainName,
  fromToken: string,
  toToken: string,
  amountInWei: string,
  userAddress: string,
  slippageTolerance: number | "auto" = "auto"
): Promise<RouteQuote> {

  // Auto-correct: If one is testnet and the other is mainnet, assume they meant testnet
  if (fromChain.includes('sepolia') && !toChain.includes('sepolia')) {
    if (toChain === 'base') toChain = 'base_sepolia';
    else if (toChain === 'arbitrum') toChain = 'arbitrum_sepolia';
    else if (toChain === 'optimism') toChain = 'optimism_sepolia';
    else if (toChain === 'ethereum') toChain = 'sepolia';
  } else if (toChain.includes('sepolia') && !fromChain.includes('sepolia')) {
    if (fromChain === 'base') fromChain = 'base_sepolia';
    else if (fromChain === 'arbitrum') fromChain = 'arbitrum_sepolia';
    else if (fromChain === 'optimism') fromChain = 'optimism_sepolia';
    else if (fromChain === 'ethereum') fromChain = 'sepolia';
  }

  // Heuristic: If either chain is a testnet, route the entire transaction to the Testnet Aggregator
  const isTestnet = fromChain.includes('sepolia') || toChain.includes('sepolia');

  if (isTestnet) {
    console.log(`[DeFi Router] Testnet detected. Routing to Testnet Aggregator (Relay, LayerZero, Arbitrum).`);
    return await fetchTestnetBestRoute(fromChain, toChain, fromToken, toToken, amountInWei, userAddress, slippageTolerance);
  } else {
    console.log(`[DeFi Router] Mainnet detected. Routing to Meta-Aggregator.`);
    return await fetchMainnetBestRoute(fromChain, toChain, fromToken, toToken, amountInWei, userAddress, slippageTolerance);
  }
}
