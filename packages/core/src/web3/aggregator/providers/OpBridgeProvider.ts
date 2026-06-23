import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { encodeFunctionData, parseAbi } from 'viem';
import crypto from 'crypto';

export class OpBridgeProvider implements DefiAggregatorProvider {
  public manifest: ProviderManifest = {
    id: 'op_bridge_testnet',
    name: 'OP Stack Standard Bridge (Testnet)',
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
    const isOpStack = request.toChain === 'optimism_sepolia' || request.toChain === 'base_sepolia';
    if (request.fromChain !== 'sepolia' || !isOpStack) return false;

    const isNative = request.fromToken.toLowerCase() === 'eth' || 
                     request.fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
                     request.fromToken === '0x0000000000000000000000000000000000000000';
    return isNative;
  }

  public async getQuote(request: QuoteRequest, context: ProviderExecutionContext): Promise<CanonicalRouteQuote> {
    // Official OP Stack L1 Standard Bridge on Sepolia
    const bridgeAddress = '0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1'; 
    
    // ABI for depositETH
    const depositEthAbi = parseAbi([
      'function depositETH(uint32 _minGasLimit, bytes _extraData) payable'
    ]);
    
    // OP Stack requires a minGasLimit. 200000 is a safe default for simple ETH transfers.
    const minGasLimit = 200000;
    const extraData = '0x';

    const callData = encodeFunctionData({
      abi: depositEthAbi,
      functionName: 'depositETH',
      args: [minGasLimit, extraData]
    });

    const destChainId = request.toChain === 'optimism_sepolia' ? 11155420 : 84532;

    return {
      provider: this.manifest.name,
      routeId: `op-bridge-${crypto.randomUUID()}`,
      fromChainId: 11155111,
      toChainId: destChainId,
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(request.amountInWei), // 1:1 bridging
      executable: true,
      expiresAt: Date.now() + 86400000,
      execution: {
        target: bridgeAddress,
        calldata: callData,
        value: BigInt(request.amountInWei)
      },
      raw: { note: 'OP Stack Standard Bridge L1->L2' }
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
