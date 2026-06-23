import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { safeFetch } from '../../../utils/httpClient';
import crypto from 'crypto';

const CHAIN_IDS: Record<string, string> = {
  ethereum: '1', base: '8453', bsc: '56', arbitrum: '42161', optimism: '10', polygon: '137',
  sepolia: '11155111', base_sepolia: '84532'
};

export class RelayProvider implements DefiAggregatorProvider {
  public manifest: ProviderManifest = {
    id: 'relay',
    name: 'Relay.link',
    version: '1.0.0',
    networks: ['mainnet', 'testnet'],
    capabilities: ['swap', 'cross_chain_swap'],
    requiredApiKeys: [],
    allowedDomains: ['api.relay.link', 'api.testnets.relay.link'],
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
    const isTestnet = request.fromChain.includes('sepolia') || request.toChain.includes('sepolia');
    const baseUrl = isTestnet ? 'https://api.testnets.relay.link' : 'https://api.relay.link';
    
    const originChainId = CHAIN_IDS[request.fromChain];
    const destChainId = CHAIN_IDS[request.toChain];

    const originCurrency = request.fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' 
      ? '0x0000000000000000000000000000000000000000' : request.fromToken;
    const destCurrency = request.toToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      ? '0x0000000000000000000000000000000000000000' : request.toToken;

    const payload = {
      user: request.userAddress,
      originChainId,
      destinationChainId: destChainId,
      originCurrency,
      destinationCurrency: destCurrency,
      recipient: request.userAddress,
      tradeType: 'EXACT_INPUT',
      amount: request.amountInWei,
      referrer: 'nyxora',
      useExternalLiquidity: false
    };

    const res = await safeFetch(`${baseUrl}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: context.abortSignal
    });

    if (!res.ok) throw new Error(`Relay API Error: ${await res.text()}`);
    const data = await res.json();

    const txPayload = data.steps?.[0]?.items?.[0]?.data;
    if (!txPayload) throw new Error("Missing Relay transaction payload");

    return {
      provider: this.manifest.name,
      routeId: `relay-${crypto.randomUUID()}`,
      fromChainId: Number(originChainId),
      toChainId: Number(destChainId),
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(data.details?.currencyOut?.amount || 0),
      executable: true,
      expiresAt: Date.now() + 60000,
      execution: {
        target: txPayload.to,
        calldata: txPayload.data,
        value: BigInt(txPayload.value || 0)
      },
      raw: data
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
