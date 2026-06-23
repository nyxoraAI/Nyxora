import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { encodeFunctionData, parseAbi } from 'viem';
import crypto from 'crypto';

export class ArbitrumBridgeProvider implements DefiAggregatorProvider {
  public manifest: ProviderManifest = {
    id: 'arbitrum_bridge_testnet',
    name: 'Arbitrum Official Bridge (Testnet)',
    version: '1.0.0',
    networks: ['testnet'],
    capabilities: ['bridge'],
    allowedDomains: [],
    permissions: {
      network: false,
      walletAccess: 'none',
      filesystem: 'none'
    }
  };

  public isCrossChainSupported(): boolean {
    return true;
  }

  public supports(request: QuoteRequest): boolean {
    if (request.fromChain !== 'sepolia' || request.toChain !== 'arbitrum_sepolia') return false;
    
    const isNative = request.fromToken.toLowerCase() === 'eth' || 
                     request.fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
                     request.fromToken === '0x0000000000000000000000000000000000000000';
    
    return isNative;
  }

  public async getQuote(request: QuoteRequest, context: ProviderExecutionContext): Promise<CanonicalRouteQuote> {
    const inboxAddress = '0xaAe29B0366299461418F5324a79Afc425BE5ae21';
    
    const depositEthAbi = parseAbi(['function depositEth() payable returns (uint256)']);
    const callData = encodeFunctionData({
      abi: depositEthAbi,
      functionName: 'depositEth'
    });

    return {
      provider: this.manifest.name,
      routeId: `arb-bridge-${crypto.randomUUID()}`,
      fromChainId: 11155111, // Sepolia
      toChainId: 421614,     // Arb Sepolia
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(request.amountInWei), // 1:1 on official bridge
      executable: true,
      expiresAt: Date.now() + 86400000, // Valid for a long time as it's a fixed contract call
      execution: {
        target: inboxAddress,
        calldata: callData,
        value: BigInt(request.amountInWei)
      },
      raw: { note: '100% Real L1->L2 Bridge Transaction via Arbitrum Delayed Inbox' }
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
