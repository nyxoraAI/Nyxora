import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { safeFetch } from '../../../utils/httpClient';
import crypto from 'crypto';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, bsc: 56, arbitrum: 42161, optimism: 10, polygon: 137
};

export class LifiProvider implements DefiAggregatorProvider {
  public manifest: ProviderManifest = {
    id: 'lifi',
    name: 'LI.FI',
    version: '1.0.0',
    networks: ['mainnet'],
    capabilities: ['swap', 'cross_chain_swap'],
    requiredApiKeys: [
      {
        id: 'lifi_key',
        label: 'LI.FI API Key',
        envKey: 'LIFI_API_KEY',
        required: false, // Lifi has a free tier
        secret: true,
        docsUrl: 'https://docs.li.fi/'
      }
    ],
    allowedDomains: ['li.quest'],
    permissions: {
      network: true,
      walletAccess: 'none',
      filesystem: 'none'
    }
  };

  public isCrossChainSupported(): boolean {
    return true;
  }

  public supports(request: QuoteRequest): boolean {
    if (!CHAIN_IDS[request.fromChain] || !CHAIN_IDS[request.toChain]) return false;
    return true;
  }

  public async getQuote(request: QuoteRequest, context: ProviderExecutionContext): Promise<CanonicalRouteQuote> {
    const key = context.apiKeys['lifi_key'];
    const slipParam = request.slippageTolerance === "auto" ? 0.005 : (request.slippageTolerance as number / 100);
    const url = `https://li.quest/v1/quote?fromChain=${request.fromChain}&toChain=${request.toChain}&fromToken=${request.fromToken}&toToken=${request.toToken}&fromAmount=${request.amountInWei}&fromAddress=${request.userAddress}&slippage=${slipParam}`;

    const headers: any = {};
    if (key) headers['x-lifi-api-key'] = key;

    const res = await safeFetch(url, {
      headers,
      signal: context.abortSignal
    });

    if (!res.ok) throw new Error(`LI.FI API Error: ${await res.text()}`);
    const data = await res.json();

    return {
      provider: this.manifest.name,
      routeId: `lifi-${crypto.randomUUID()}`,
      fromChainId: CHAIN_IDS[request.fromChain],
      toChainId: CHAIN_IDS[request.toChain],
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(data.estimate.toAmount),
      estimatedGasUsd: Number(data.estimate.gasCosts?.[0]?.amountUSD || 0),
      executable: true,
      expiresAt: Date.now() + 60000,
      execution: {
        target: data.transactionRequest.to,
        calldata: data.transactionRequest.data,
        value: BigInt(data.transactionRequest.value || 0)
      },
      raw: data
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
