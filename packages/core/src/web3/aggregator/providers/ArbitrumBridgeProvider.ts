import { DefiAggregatorProvider, ProviderExecutionContext, ProviderHealth, ProviderManifest, QuoteRequest, CanonicalRouteQuote } from '../types';
import { encodeFunctionData, parseAbi, createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
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
    const isL1ToL2 = request.fromChain === 'sepolia' && (request.toChain === 'arbitrum_sepolia' || request.toChain === 'robinhood_testnet');
    const isL2ToL1 = request.toChain === 'sepolia' && (request.fromChain === 'arbitrum_sepolia' || request.fromChain === 'robinhood_testnet');
    
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
    let maxSubmissionCost = 0n;
    
    if (isL1ToL2) {
      maxSubmissionCost = 50000000000000n; // Default 0.00005 ETH

      try {
        const client = createPublicClient({ chain: sepolia, transport: http() });
        const feeData = await client.estimateFeesPerGas();
        const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 2000000000n;
        // Formula buffer: 300% of L1 base fee * 1000 for safety overhead on testnet
        maxSubmissionCost = maxFeePerGas * 3000n;
        if (maxSubmissionCost < 50000000000000n) {
          maxSubmissionCost = 50000000000000n; // Minimum 0.00005 ETH
        }
      } catch (e) {
        // Fallback to default if RPC fails
      }

      if (request.toChain === 'robinhood_testnet') {
        targetAddress = '0xF2939afA86F6f933A3CE17fCAB007907B6b0B7a4'; // Robinhood Delayed Inbox (Testnet)
        const createRetryableTicketAbi = parseAbi([
          'function createRetryableTicket(address to, uint256 l2CallValue, uint256 maxSubmissionCost, address excessFeeRefundAddress, address callValueRefundAddress, uint256 gasLimit, uint256 maxFeePerGas, bytes calldata data) payable returns (uint256)'
        ]);
        callData = encodeFunctionData({
          abi: createRetryableTicketAbi,
          functionName: 'createRetryableTicket',
          args: [
            request.userAddress as `0x${string}`, // to
            BigInt(request.amountInWei),          // l2CallValue
            maxSubmissionCost,                    // maxSubmissionCost
            request.userAddress as `0x${string}`, // excessFeeRefundAddress
            request.userAddress as `0x${string}`, // callValueRefundAddress
            100000n,                              // gasLimit
            100000000n,                           // maxFeePerGas (0.1 gwei)
            "0x"                                  // data
          ]
        });
      } else {
        targetAddress = '0xaAe29B0366299461418F5324a79Afc425BE5ae21'; // Arbitrum Sepolia Delayed Inbox
        const depositEthAbi = parseAbi(['function depositEth() payable returns (uint256)']);
        callData = encodeFunctionData({
          abi: depositEthAbi,
          functionName: 'depositEth'
        });
      }
    } else {
      targetAddress = '0x0000000000000000000000000000000000000064'; // ArbSys precompile
      const withdrawEthAbi = parseAbi(['function withdrawEth(address destination) payable returns (uint256)']);
      callData = encodeFunctionData({
        abi: withdrawEthAbi,
        functionName: 'withdrawEth',
        args: [request.userAddress as `0x${string}`]
      });
    }

    const note = isL1ToL2 ? '100% Real L1->L2 Bridge Transaction via Delayed Inbox' : 'ArbSys L2->L1 Withdrawal (Requires ~7 day challenge period)';

    let toChainId = 11155111;
    let fromChainId = 11155111;

    if (isL1ToL2) {
        toChainId = request.toChain === 'robinhood_testnet' ? 46630 : 421614;
    } else {
        fromChainId = request.fromChain === 'robinhood_testnet' ? 46630 : 421614;
    }

    return {
      provider: this.manifest.name,
      routeId: `arb-bridge-${crypto.randomUUID()}`,
      fromChainId: fromChainId,
      toChainId: toChainId,
      inputAmount: BigInt(request.amountInWei),
      outputAmount: BigInt(request.amountInWei), // 1:1 on official bridge
      executable: true,
      expiresAt: Date.now() + 86400000, // Valid for a long time as it's a fixed contract call
      execution: {
        target: targetAddress,
        calldata: callData,
        value: (isL1ToL2 && request.toChain === 'robinhood_testnet') ? BigInt(request.amountInWei) + maxSubmissionCost + (100000n * 100000000n) : BigInt(request.amountInWei)
      },
      raw: { note }
    };
  }

  public async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: Date.now() };
  }
}
