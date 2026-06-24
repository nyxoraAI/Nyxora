import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { safeFetch } from '../../../utils/httpClient';
import crypto from 'crypto';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, bsc: 56, arbitrum: 42161, optimism: 10, polygon: 137
};

export class KyberSwapProvider implements DefiAggregatorProvider {
  public manifest: ProviderManifest = {
    id: 'kyberswap',
    name: 'KyberSwap',
    version: '1.0.0',
    networks: ['mainnet'],
    capabilities: ['swap'],
    allowedDomains: ['aggregator-api.kyberswap.com'],
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
    const chainName = request.fromChain.toLowerCase().replace(/_/g, '');
    const slipParam = request.slippageTolerance === "auto" ? 50 : (request.slippageTolerance as number * 100);
    
    // Phase 1: Route
    const routeUrl = `https://aggregator-api.kyberswap.com/${chainName}/api/v1/routes?tokenIn=${request.fromToken}&tokenOut=${request.toToken}&amountIn=${request.amountInWei}`;
    const routeRes = await safeFetch(routeUrl, { signal: context.abortSignal, retries: 0 });
    if (!routeRes.ok) throw new Error(`KyberSwap Route Error: ${await routeRes.text()}`);
    const routeData = await routeRes.json();
    
    if (!routeData.data || !routeData.data.routeSummary) throw new Error("No Kyber route found");

    // Phase 2: Build
    const buildPayload = {
      routeSummary: routeData.data.routeSummary,
      sender: request.userAddress,
      recipient: request.userAddress,
      slippageTolerance: slipParam
    };

    const buildRes = await safeFetch(`https://aggregator-api.kyberswap.com/${chainName}/api/v1/route/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload),
      signal: context.abortSignal,
      retries: 0
    });
    if (!buildRes.ok) throw new Error(`KyberSwap Build Error: ${await buildRes.text()}`);
    const buildData = await buildRes.json();

    // KyberSwap returns calldata in 'data' field, and router address in 'routerAddress'
    if (!buildData.data || !buildData.data.routerAddress || !buildData.data.data) {
      throw new Error(`KyberSwap build response missing required fields (routerAddress or data). Got: ${JSON.stringify(Object.keys(buildData.data || {}))}`);
    }

    const isNative = request.fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    return {
      provider: this.manifest.name,
      routeId: `kyber-${crypto.randomUUID()}`,
      fromChainId: CHAIN_IDS[request.fromChain],
      toChainId: CHAIN_IDS[request.toChain],
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(routeData.data.routeSummary.amountOut),
      estimatedGasUsd: Number(routeData.data.routeSummary.gasUsd || 0),
      executable: true,
      expiresAt: Date.now() + 60000,
      execution: {
        target: buildData.data.routerAddress,
        calldata: buildData.data.data,
        value: isNative ? BigInt(request.amountInWei) : 0n
      },
      raw: buildData.data
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
