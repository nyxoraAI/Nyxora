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
    const isL1ToL2 = request.fromChain === 'sepolia' && (request.toChain === 'optimism_sepolia' || request.toChain === 'base_sepolia');
    const isL2ToL1 = request.toChain === 'sepolia' && (request.fromChain === 'optimism_sepolia' || request.fromChain === 'base_sepolia');
    
    if (!isL1ToL2 && !isL2ToL1) return false;

    const isNative = request.fromToken.toLowerCase() === 'eth' || 
                     request.fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
                     request.fromToken === '0x0000000000000000000000000000000000000000';
    return isNative;
  }

  public async getQuote(request: QuoteRequest, context: ProviderExecutionContext): Promise<CanonicalRouteQuote> {
    const isL1ToL2 = request.fromChain === 'sepolia';
    
    let bridgeAddress: string;
    let callData: string;

    if (isL1ToL2) {
      // L1 to L2
      const BRIDGE_ADDRESSES: Record<string, string> = {
        optimism_sepolia: '0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1', 
        base_sepolia:     '0xfd0Bf71F60660E2f608ed56e1659C450eB113120', 
      };
      bridgeAddress = BRIDGE_ADDRESSES[request.toChain];
      if (!bridgeAddress) {
        throw new Error(`[OpBridgeProvider] No bridge address configured for destination chain: ${request.toChain}`);
      }
      
      const depositEthAbi = parseAbi([
        'function depositETH(uint32 _minGasLimit, bytes _extraData) payable'
      ]);
      callData = encodeFunctionData({
        abi: depositEthAbi,
        functionName: 'depositETH',
        args: [200000, '0x']
      });
    } else {
      // L2 to L1
      bridgeAddress = '0x4200000000000000000000000000000000000010'; // L2StandardBridge predeploy on OP Stack
      const bridgeEthAbi = parseAbi([
        'function bridgeETH(uint32 _minGasLimit, bytes _extraData) payable'
      ]);
      callData = encodeFunctionData({
        abi: bridgeEthAbi,
        functionName: 'bridgeETH',
        args: [200000, '0x']
      });
    }

    const getChainId = (name: string) => name === 'sepolia' ? 11155111 : (name === 'optimism_sepolia' ? 11155420 : 84532);

    const note = isL1ToL2 ? 'OP Stack Standard Bridge L1->L2' : 'OP Stack Standard Bridge L2->L1 (Requires 7-day challenge period to finalize)';

    return {
      provider: this.manifest.name,
      routeId: `op-bridge-${crypto.randomUUID()}`,
      fromChainId: getChainId(request.fromChain),
      toChainId: getChainId(request.toChain),
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(request.amountInWei), // 1:1 bridging
      executable: true,
      expiresAt: Date.now() + 86400000,
      execution: {
        target: bridgeAddress,
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
