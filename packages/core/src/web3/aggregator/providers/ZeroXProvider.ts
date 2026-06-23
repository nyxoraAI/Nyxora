import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { safeFetch } from '../../../utils/httpClient';
import crypto from 'crypto';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, bsc: 56, arbitrum: 42161, optimism: 10, polygon: 137
};

export class ZeroXProvider implements DefiAggregatorProvider {
  public manifest: ProviderManifest = {
    id: '0x',
    name: '0x API',
    version: '1.0.0',
    networks: ['mainnet'],
    capabilities: ['swap'],
    requiredApiKeys: [
      {
        id: 'zero_x_key',
        label: '0x API Key',
        envKey: 'ZEROX_API_KEY',
        required: true,
        secret: true,
        docsUrl: 'https://0x.org/docs/0x-swap-api/introduction'
      }
    ],
    allowedDomains: ['api.0x.org'],
    permissions: {
      network: true,
      walletAccess: 'none',
      filesystem: 'none'
    }
  };

  public isCrossChainSupported(): boolean {
    return false;
  }

  public supports(request: QuoteRequest): boolean {
    if (request.fromChain !== request.toChain) return false;
    if (!CHAIN_IDS[request.fromChain]) return false;
    return true;
  }

  public async getQuote(request: QuoteRequest, context: ProviderExecutionContext): Promise<CanonicalRouteQuote> {
    const key = context.apiKeys['zero_x_key'];
    if (!key) throw new Error(`[ZeroXProvider] Missing required API key 'zero_x_key'`);

    const slipParam = request.slippageTolerance === "auto" ? "0.005" : (request.slippageTolerance as number / 100).toString();
    const url = `https://api.0x.org/swap/v1/quote?sellToken=${request.fromToken}&buyToken=${request.toToken}&sellAmount=${request.amountInWei}&takerAddress=${request.userAddress}&slippagePercentage=${slipParam}`;

    const res = await safeFetch(url, {
      headers: { '0x-api-key': key },
      signal: context.abortSignal
    });

    if (!res.ok) throw new Error(`0x API Error: ${await res.text()}`);
    const data = await res.json();

    return {
      provider: this.manifest.name,
      routeId: `0x-${crypto.randomUUID()}`,
      fromChainId: CHAIN_IDS[request.fromChain],
      toChainId: CHAIN_IDS[request.toChain],
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(data.buyAmount),
      executable: true,
      expiresAt: Date.now() + 60000,
      execution: {
        target: data.to,
        calldata: data.data,
        value: BigInt(data.value || 0)
      },
      raw: data
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
