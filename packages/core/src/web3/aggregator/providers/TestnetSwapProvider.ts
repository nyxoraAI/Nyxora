import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import crypto from 'crypto';

export class TestnetSwapProvider implements DefiAggregatorProvider {
  public manifest: ProviderManifest = {
    id: 'testnet_mock_swap',
    name: 'Testnet Simulated Swap',
    version: '1.0.1',
    networks: ['testnet'],
    capabilities: ['swap'],
    allowedDomains: [],
    permissions: {
      network: false,
      walletAccess: 'none',
      filesystem: 'none'
    }
  };

  public isCrossChainSupported(): boolean {
    return false;
  }

  public supports(request: QuoteRequest): boolean {
    if (request.fromChain !== request.toChain) return false;
    // Only support testnet chains
    return request.fromChain.includes('sepolia');
  }

  public async getQuote(request: QuoteRequest, context: ProviderExecutionContext): Promise<CanonicalRouteQuote> {
    const chainIds: Record<string, number> = {
      sepolia: 11155111,
      base_sepolia: 84532,
      optimism_sepolia: 11155420,
      arbitrum_sepolia: 421614
    };

    // Simulate 1:0.98 exchange rate for testing (or a fixed amount if amounts aren't known)
    // To make it look realistic, we just output 98% of the input conceptually (not accurate for different decimals, but works for mock UX).
    const outAmount = (BigInt(request.amountInWei) * 98n) / 100n;

    return {
      provider: this.manifest.name,
      routeId: `testnet-swap-${crypto.randomUUID()}`,
      fromChainId: chainIds[request.fromChain] || 11155111,
      toChainId: chainIds[request.toChain] || 11155111,
      inputAmount: BigInt(request.amountInWei),
      outputAmount: outAmount, 
      estimatedGasUsd: 0.05,
      executable: true,
      expiresAt: Date.now() + 86400000,
      execution: {
        // Send a 0 value transaction to the user's own address to simulate contract interaction
        // without actually losing testnet funds or failing.
        target: request.userAddress,
        calldata: '0x',
        value: 0n 
      },
      raw: { note: 'Simulated Testnet Swap. Generating a dummy zero-value transaction for UI verification.' }
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
