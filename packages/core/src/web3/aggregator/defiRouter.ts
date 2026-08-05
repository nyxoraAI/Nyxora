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

  // Auto-correct: If one side is testnet and the other is mainnet, assume they meant testnet.
  // This prevents cross-environment (testnet→mainnet) bridge attempts.
  const isFromTestnet = fromChain.includes('sepolia') || fromChain === 'robinhood_testnet';
  const isToTestnet = toChain.includes('sepolia') || toChain === 'robinhood_testnet';

  if (isFromTestnet && !isToTestnet) {
    if (toChain === 'base') toChain = 'base_sepolia';
    else if (toChain === 'arbitrum') toChain = 'arbitrum_sepolia';
    else if (toChain === 'optimism') toChain = 'optimism_sepolia';
    else if (toChain === 'ethereum') toChain = 'sepolia';
    else if (toChain === 'robinhood') toChain = 'robinhood_testnet';
  } else if (isToTestnet && !isFromTestnet) {
    if (fromChain === 'base') fromChain = 'base_sepolia';
    else if (fromChain === 'arbitrum') fromChain = 'arbitrum_sepolia';
    else if (fromChain === 'optimism') fromChain = 'optimism_sepolia';
    else if (fromChain === 'ethereum') fromChain = 'sepolia';
    else if (fromChain === 'robinhood') fromChain = 'robinhood_testnet';
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
