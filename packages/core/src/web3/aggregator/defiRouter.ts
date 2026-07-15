import { ChainName } from '../config';
import { fetchBestRoute } from './routeSelector';
import { QuoteRequest, CanonicalRouteQuote } from './types';

export async function routeTransaction(
  fromChain: string,
  toChain: string,
  fromToken: string,
  toToken: string,
  amountInWei: string,
  amountFormatted: string | undefined,
  userAddress: string,
  slippageTolerance: number | "auto" = "auto",
  providerName?: string
): Promise<CanonicalRouteQuote> {
  fromChain = String(fromChain || "");
  toChain = String(toChain || "");

  if (!fromChain || !toChain) {
    throw new Error("Missing source or destination chain in routing.");
  }

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

  const request: QuoteRequest = {
    fromChain,
    toChain,
    fromToken,
    toToken,
    amountInWei,
    amountFormatted,
    userAddress,
    slippageTolerance,
    preferredProvider: providerName && providerName !== "auto" ? providerName : undefined
  };

  console.log(`[DeFi Router] Routing transaction via Extensible Provider Runtime...`);
  return await fetchBestRoute(request, "best_output");
}
