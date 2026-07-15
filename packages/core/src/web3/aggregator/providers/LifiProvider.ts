import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { safeFetch } from '../../../utils/httpClient';
import crypto from 'crypto';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, bsc: 56, arbitrum: 42161, optimism: 10, polygon: 137, robinhood: 4663
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
    const fromChainId = CHAIN_IDS[request.fromChain];
    const toChainId = CHAIN_IDS[request.toChain];
    const url = `https://li.quest/v1/quote?fromChain=${fromChainId}&toChain=${toChainId}&fromToken=${request.fromToken}&toToken=${request.toToken}&fromAmount=${request.amountInWei}&fromAddress=${request.userAddress}&slippage=${slipParam}`;

    const headers: any = {};
    if (key) headers['x-lifi-api-key'] = key;

    const res = await safeFetch(url, {
      headers,
      signal: context.abortSignal,
      retries: 0
    });

    if (!res.ok) throw new Error(`LI.FI API Error: ${await res.text()}`);
    const data = await res.json();

    // LiFi can return HTTP 200 with an 'errors' array if a tool fails
    if (data.errors && data.errors.length > 0) {
      const err = data.errors[0];
      throw new Error(`LI.FI route error (${err.code || 'UNKNOWN'}): ${err.message}`);
    }

    // transactionRequest may be null if LiFi found no executable route
    if (!data.transactionRequest || !data.transactionRequest.to) {
      throw new Error(`[LifiProvider] No valid transactionRequest returned — no executable route found`);
    }

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
