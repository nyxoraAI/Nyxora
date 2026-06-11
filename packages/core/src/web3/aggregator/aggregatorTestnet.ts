
import { RouteQuote } from './aggregatorMainnet';
import { ChainName } from '../config';
import { loadDefiKeys } from '../../config/defiConfigManager';
import { safeFetch } from '../../utils/httpClient';
import { encodeFunctionData, parseAbi } from 'viem';

export async function fetchTestnetBestRoute(
  fromChain: ChainName,
  toChain: ChainName,
  fromToken: string,
  toToken: string,
  amountInWei: string,
  userAddress: string,
  slippageTolerance: number | "auto" = "auto"
): Promise<RouteQuote> {
  const promises: Promise<RouteQuote | null>[] = [];

  // Routing Logic
  const isRelayRoute = (fromChain === 'sepolia' && toChain === 'base_sepolia') || 
                       (fromChain === 'base_sepolia' && toChain === 'sepolia');
                       
  const isArbitrumRoute = (fromChain === 'sepolia' && toChain === 'arbitrum_sepolia') || 
                          (fromChain === 'arbitrum_sepolia' && toChain === 'sepolia');

  if (isRelayRoute) {
    promises.push(fetchRelayTestnet(fromChain, toChain, fromToken, toToken, amountInWei, userAddress));
  } else if (isArbitrumRoute) {
    promises.push(fetchArbitrumBridgeTestnet(fromChain, toChain, fromToken, toToken, amountInWei, userAddress));
  } else {
    throw new Error(`[Testnet Meta-Aggregator] Unsupported testnet route from ${fromChain} to ${toChain}. Only Sepolia <-> Base Sepolia or Sepolia <-> Arbitrum Sepolia are supported.`);
  }

  const results = await Promise.allSettled(promises);
  
  let bestQuote: RouteQuote | null = null;
  for (const res of results) {
    if (res.status === 'fulfilled' && res.value) {
      if (!bestQuote || BigInt(res.value.expectedOutputRaw) > BigInt(bestQuote.expectedOutputRaw)) {
        bestQuote = res.value;
      }
    }
  }

  if (!bestQuote) {
    throw new Error(`[Testnet Meta-Aggregator] No routes found between ${fromChain} and ${toChain} for given tokens.`);
  }

  return bestQuote;
}

async function fetchRelayTestnet(fromChain: string, toChain: string, fromToken: string, toToken: string, amount: string, address: string): Promise<RouteQuote | null> {
  try {
    const RELAY_CHAIN_MAP: Record<string, string> = {
      'sepolia': '11155111',
      'base_sepolia': '84532'
    };
    const originChainId = RELAY_CHAIN_MAP[fromChain];
    const destChainId = RELAY_CHAIN_MAP[toChain];
    if (!originChainId || !destChainId) return null;

    const payload = {
      user: address, originChainId, destinationChainId: destChainId,
      originCurrency: fromToken, destinationCurrency: toToken,
      recipient: address, tradeType: 'EXACT_INPUT', amount,
      referrer: 'nyxora', useExternalLiquidity: false
    };

    const res = await safeFetch('https://api.testnets.relay.link/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      provider: 'Relay (Testnet)',
      txPayload: data.steps?.[0]?.items?.[0]?.data,
      expectedOutput: data.details?.currencyOut?.amount,
      expectedOutputRaw: data.details?.currencyOut?.amount,
      gasCostUsd: 0, rawQuote: data
    };
  } catch (e) { return null; }
}

async function fetchArbitrumBridgeTestnet(fromChain: string, toChain: string, fromToken: string, toToken: string, amount: string, address: string): Promise<RouteQuote | null> {
  const isValidRoute = (fromChain === 'sepolia' && toChain === 'arbitrum_sepolia');
  // NOTE: Currently only implementing L1 -> L2 (Sepolia to Arbitrum Sepolia) for simplicity.
  // L2 -> L1 requires withdrawal proofs which is complex to mock/simulate here in a single tx.
  if (!isValidRoute) {
    throw new Error(`[Arbitrum Bridge] Only Sepolia -> Arbitrum Sepolia is currently supported for direct L1->L2 bridging.`);
  }

  // Ensure it's Native ETH
  const isNative = fromToken.toLowerCase() === 'eth' || 
                   fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
                   fromToken === '0x0000000000000000000000000000000000000000';
  if (!isNative) {
    throw new Error(`[Arbitrum Bridge] Only Native ETH bridging is supported via the Delayed Inbox.`);
  }

  // Official Arbitrum Sepolia Delayed Inbox Address on L1
  const inboxAddress = '0xaAe29B0366299461418F5324a79Afc425BE5ae21';
  
  // Real ABI encoding for depositEth()
  const depositEthAbi = parseAbi(['function depositEth() payable returns (uint256)']);
  const callData = encodeFunctionData({
    abi: depositEthAbi,
    functionName: 'depositEth'
  });

  const realPayload = {
    to: inboxAddress,
    data: callData,
    value: amount
  };

  return {
    provider: 'Arbitrum Official Bridge (Testnet)',
    txPayload: realPayload,
    expectedOutput: amount, // 1:1 on official bridge
    expectedOutputRaw: amount,
    gasCostUsd: 0, 
    rawQuote: { note: '100% Real L1->L2 Bridge Transaction via Arbitrum Delayed Inbox' }
  };
}
