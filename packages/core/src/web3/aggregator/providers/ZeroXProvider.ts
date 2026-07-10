import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { safeFetch } from '../../../utils/httpClient';
import crypto from 'crypto';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, bsc: 56, arbitrum: 42161, optimism: 10, polygon: 137, robinhood: 4663
};

export class ZeroXProvider implements DefiAggregatorProvider {
  public manifest: ProviderManifest = {
    id: '0x',
    name: '0x API',
    version: '2.0.0', // Updated to v2
    networks: ['mainnet'],
    capabilities: ['swap'],
    requiredApiKeys: [
      {
        id: 'zero_x_key',
        label: '0x API Key',
        envKey: 'ZEROX_API_KEY',
        required: true,
        secret: true,
        docsUrl: 'https://0x.org/docs/introduction/getting-started'
      }
    ],
    // v2 uses a single unified endpoint, no longer chain-specific subdomains
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

    const chainId = CHAIN_IDS[request.fromChain];

    // v2: slippage is in BASIS POINTS (bps), NOT percentage decimal
    // 0.5% = 50 bps
    const slipBps = request.slippageTolerance === "auto"
      ? "50"
      : Math.round((request.slippageTolerance as number) * 100).toString();

    // v2: unified URL, chain differentiated by chainId param
    // Using /allowance-holder/quote as it's simpler (no EIP-712 signing required)
    const params = new URLSearchParams({
      chainId: String(chainId),
      sellToken: request.fromToken,
      buyToken: request.toToken,
      sellAmount: request.amountInWei,
      taker: request.userAddress, // v2: 'taker' replaces v1's 'takerAddress'
      slippageBps: slipBps,       // v2: 'slippageBps' replaces v1's 'slippagePercentage'
    });

    const url = `https://api.0x.org/swap/allowance-holder/quote?${params.toString()}`;

    const res = await safeFetch(url, {
      headers: {
        '0x-api-key': key,
        '0x-version': 'v2'  // v2: mandatory version header
      },
      signal: context.abortSignal,
      retries: 0
    });

    if (!res.ok) throw new Error(`0x API v2 Error: ${await res.text()}`);
    const data = await res.json();

    if (data.liquidityAvailable === false) {
      throw new Error(`[ZeroXProvider] No liquidity available for this pair`);
    }

    // v2: transaction fields are nested under data.transaction, NOT root level
    if (!data.transaction || !data.transaction.to || !data.transaction.data) {
      throw new Error(`[ZeroXProvider] Missing transaction payload in v2 response`);
    }

    return {
      provider: this.manifest.name,
      routeId: `0x-${crypto.randomUUID()}`,
      fromChainId: chainId,
      toChainId: chainId,
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(data.buyAmount),
      executable: true,
      expiresAt: Date.now() + 60000,
      approvalAddress: data.issues?.allowance?.spender || data.transaction.to,
      execution: {
        target: data.transaction.to,    // FIXED: was data.to in v1
        calldata: data.transaction.data, // FIXED: was data.data in v1
        value: BigInt(data.transaction.value || 0) // FIXED: was data.value in v1
      },
      raw: data
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
