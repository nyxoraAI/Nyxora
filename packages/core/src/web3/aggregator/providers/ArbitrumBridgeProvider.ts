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
    const isL1ToL2 = request.fromChain === 'sepolia' && request.toChain === 'arbitrum_sepolia';
    const isL2ToL1 = request.toChain === 'sepolia' && request.fromChain === 'arbitrum_sepolia';
    
    if (!isL1ToL2 && !isL2ToL1) return false;
    
    const isNative = request.fromToken.toLowerCase() === 'eth' || 
                     request.fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
                     request.fromToken === '0x0000000000000000000000000000000000000000';
    
    return isNative;
  }

  public async getQuote(request: QuoteRequest, context: ProviderExecutionContext): Promise<CanonicalRouteQuote> {
    const isL1ToL2 = request.fromChain === 'sepolia';
    
    let targetAddress: string;
    let callData: string;
    
    if (isL1ToL2) {
      targetAddress = '0xaAe29B0366299461418F5324a79Afc425BE5ae21'; // Delayed Inbox
      const depositEthAbi = parseAbi(['function depositEth() payable returns (uint256)']);
      callData = encodeFunctionData({
        abi: depositEthAbi,
        functionName: 'depositEth'
      });
    } else {
      targetAddress = '0x0000000000000000000000000000000000000064'; // ArbSys precompile
      const withdrawEthAbi = parseAbi(['function withdrawEth(address destination) payable returns (uint256)']);
      callData = encodeFunctionData({
        abi: withdrawEthAbi,
        functionName: 'withdrawEth',
        args: [request.userAddress as `0x${string}`]
      });
    }

    const note = isL1ToL2 ? '100% Real L1->L2 Bridge Transaction via Arbitrum Delayed Inbox' : 'Arbitrum ArbSys L2->L1 Withdrawal (Requires ~7 day challenge period)';

    return {
      provider: this.manifest.name,
      routeId: `arb-bridge-${crypto.randomUUID()}`,
      fromChainId: isL1ToL2 ? 11155111 : 421614,
      toChainId: isL1ToL2 ? 421614 : 11155111,
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(request.amountInWei), // 1:1 on official bridge
      executable: true,
      expiresAt: Date.now() + 86400000, // Valid for a long time as it's a fixed contract call
      execution: {
        target: targetAddress,
        calldata: callData,
        value: BigInt(request.amountInWei)
      },
      raw: { note }
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
