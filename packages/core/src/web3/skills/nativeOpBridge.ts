import { encodeFunctionData, parseAbi } from 'viem';
import { RouteQuote } from '../aggregator/aggregatorMainnet';

const OP_L1_PORTAL_MAP: Record<string, string> = {
  'base_sepolia': '0xfd0bf71f60660e2f608ed56e1659c450eb113120',
  'optimism_sepolia': '0xfbb0621e0b23b5478b630bd55a5f21f67730b0f1'
};

const L2_STANDARD_BRIDGE = '0x4200000000000000000000000000000000000010';

export async function fetchNativeOpBridgeTestnet(
  fromChain: string, 
  toChain: string, 
  fromToken: string, 
  toToken: string, 
  amount: string, 
  address: string
): Promise<RouteQuote | null> {
  const isL1toL2 = fromChain === 'sepolia' && OP_L1_PORTAL_MAP[toChain];
  const isL2toL1 = toChain === 'sepolia' && OP_L1_PORTAL_MAP[fromChain];

  if (!isL1toL2 && !isL2toL1) {
    throw new Error(`[Native OP Bridge] Unsupported route from ${fromChain} to ${toChain}`);
  }

  // Ensure it's Native ETH for simplicity
  const isNative = fromToken.toLowerCase() === 'eth' || 
                   fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
                   fromToken === '0x0000000000000000000000000000000000000000';
  
  if (!isNative) {
    throw new Error(`[Native OP Bridge] Only Native ETH bridging is supported natively in this version.`);
  }

  if (isL1toL2) {
    // Deposit (L1 -> L2)
    const portalAddress = OP_L1_PORTAL_MAP[toChain];
    const bridgeEthAbi = parseAbi(['function bridgeETHTo(address _to, uint32 _minGasLimit, bytes _extraData) payable']);
    const callData = encodeFunctionData({
      abi: bridgeEthAbi,
      functionName: 'bridgeETHTo',
      args: [address as `0x${string}`, 200000, '0x']
    });

    return {
      provider: 'Native OP Stack Bridge (L1->L2)',
      txPayload: {
        to: portalAddress,
        data: callData,
        value: amount
      },
      expectedOutput: amount,
      expectedOutputRaw: amount,
      gasCostUsd: 0, 
      rawQuote: { note: 'Direct L1->L2 Deposit via OP Portal. Funds will arrive instantly on L2.' }
    };
  } else {
    // Withdrawal (L2 -> L1)
    const withdrawEthAbi = parseAbi(['function bridgeETHTo(address _to, uint32 _minGasLimit, bytes _extraData) payable']);
    const callData = encodeFunctionData({
      abi: withdrawEthAbi,
      functionName: 'bridgeETHTo',
      args: [address as `0x${string}`, 200000, '0x']
    });

    return {
      provider: 'Native OP Stack Bridge (L2->L1)',
      txPayload: {
        to: L2_STANDARD_BRIDGE,
        data: callData,
        value: amount
      },
      expectedOutput: amount,
      expectedOutputRaw: amount,
      gasCostUsd: 0, 
      rawQuote: { 
        note: 'Direct L2->L1 Withdrawal. WARNING: Requires 7-day challenge period.',
        isAsyncWithdrawal: true,
        l1PortalAddress: OP_L1_PORTAL_MAP[fromChain]
      }
    };
  }
}
