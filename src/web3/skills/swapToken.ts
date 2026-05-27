import { parseUnits, formatUnits } from 'viem';
import { getWalletClient, getPublicClient, ChainName } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI } from '../utils/tokens';

const CHAIN_IDS: Record<ChainName, number> = {
  ethereum: 1,
  base: 8453,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  sepolia: 11155111,
};

async function getLifiQuote(fromChainId: number, toChainId: number, fromToken: string, toToken: string, amountWei: string, userAddress: string, slippage: number) {
  const url = new URL('https://li.quest/v1/quote');
  url.searchParams.append('fromChain', fromChainId.toString());
  url.searchParams.append('toChain', toChainId.toString());
  url.searchParams.append('fromToken', fromToken);
  url.searchParams.append('toToken', toToken);
  url.searchParams.append('fromAmount', amountWei);
  url.searchParams.append('fromAddress', userAddress);
  url.searchParams.append('slippage', slippage.toString());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Li.Fi API Error: ${err.message || res.statusText}`);
  }
  return await res.json();
}

async function getRelayQuote(fromChainId: number, toChainId: number, fromToken: string, toToken: string, amountWei: string, userAddress: string) {
  const isTestnet = fromChainId === 11155111 || toChainId === 11155111;
  const baseUrl = isTestnet ? "https://api.testnets.relay.link" : "https://api.relay.link";

  const body = {
    user: userAddress,
    originChainId: fromChainId,
    destinationChainId: toChainId,
    originCurrency: fromToken,
    destinationCurrency: toToken,
    amount: amountWei,
    tradeType: "EXACT_INPUT"
  };

  const res = await fetch(`${baseUrl}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Relay API Error: ${err.message || res.statusText}`);
  }
  return await res.json();
}

export async function prepareSwapToken(
  chainName: ChainName, 
  fromToken: string, 
  toToken: string, 
  amountStr: string,
  mode: "auto" | "manual" = "auto",
  providerName: "lifi" | "relay" = "lifi",
  slippagePercent: number = 0.5
): Promise<string> {
  try {
    const publicClient = getPublicClient(chainName);
    const walletClient = getWalletClient(chainName);
    const account = walletClient.account!;
    const chainId = CHAIN_IDS[chainName];
    
    const fromTokenAddress = resolveToken(fromToken, chainName);
    const toTokenAddress = resolveToken(toToken, chainName);
    const isNativeIn = fromTokenAddress === "0x0000000000000000000000000000000000000000";

    // Get decimals
    let decimals = 18;
    if (!isNativeIn) {
      decimals = await publicClient.readContract({
        address: fromTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as number;
    }
    const amountWei = parseUnits(amountStr, decimals).toString();

    let txRequest: any = null;
    let approvalAddress: string | null = null;
    let expectedOutputStr = "";

    let actualProvider = mode === "auto" ? "lifi" : providerName;
    const isTestnet = chainId === 11155111;

    // --- SEPOLIA TESTNET MOCK ---
    if (isTestnet) {
      const mockGasLimit = "150000";
      expectedOutputStr = "MOCK_TEST_AMOUNT";
      
      const tx = txManager.createPendingTransaction('swap', chainName, { 
        txRequest: { to: fromTokenAddress, data: "0x", value: amountWei, gasLimit: mockGasLimit }, 
        needsApprove: false,
        fromTokenAddress,
        approvalAddress: null,
        amountWei
      });

      return `TRANSACTION_PENDING: Swap simulated via TESTNET_MOCK. Expected Output: ~${expectedOutputStr} ${toToken.toUpperCase()}. Gas est: ${mockGasLimit}. Transaction ID: ${tx.id}. Wait for user to approve.`;
    }
    // --- END MOCK ---

    if (actualProvider === "lifi") {
      const quote = await getLifiQuote(chainId, chainId, fromTokenAddress, toTokenAddress, amountWei, account.address, slippagePercent / 100);
      txRequest = quote.transactionRequest;
      approvalAddress = quote.estimate.approvalAddress;
      
      const toDecimals = quote.action.toToken.decimals;
      expectedOutputStr = formatUnits(BigInt(quote.estimate.toAmount), toDecimals);
    } else if (actualProvider === "relay") {
      const relayQuote = await getRelayQuote(chainId, chainId, fromTokenAddress, toTokenAddress, amountWei, account.address);
      if (!relayQuote.steps || relayQuote.steps.length === 0) throw new Error("No route found by Relay.");
      
      // Relay returns steps. We need to find the main transaction step.
      const txStep = relayQuote.steps.find((s: any) => s.id === "execute");
      if (!txStep || !txStep.items || txStep.items.length === 0) throw new Error("Relay steps invalid.");
      const item = txStep.items[0];
      txRequest = item.data;
      
      // Usually Relay route approval to `txRequest.to` if it's not native
      if (!isNativeIn && txRequest.to.toLowerCase() !== fromTokenAddress.toLowerCase()) {
        approvalAddress = txRequest.to;
      }
      
      expectedOutputStr = relayQuote.details?.currencyOut?.amountFormatted || "Unknown";
    }

    // Check allowance early so we know if we need to auto-approve
    let needsApprove = false;
    if (!isNativeIn && approvalAddress && approvalAddress !== "0x0000000000000000000000000000000000000000") {
      const allowance = await publicClient.readContract({
        address: fromTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, approvalAddress as `0x${string}`],
      }) as bigint;
      if (allowance < BigInt(amountWei)) {
        needsApprove = true;
      }
    }

    const tx = txManager.createPendingTransaction('swap', chainName, { 
      txRequest, 
      needsApprove,
      fromTokenAddress,
      approvalAddress,
      amountWei
    });

    return `TRANSACTION_PENDING: Swap simulated via ${actualProvider.toUpperCase()}. Expected Output: ~${expectedOutputStr} ${toToken.toUpperCase()}. ${needsApprove ? '(Auto-Approve required) ' : ''}Gas est: ${txRequest.gasLimit || 'auto'}. Transaction ID: ${tx.id}. Wait for user to approve.`;
  } catch (error: any) {
    return `Simulation failed! Cannot prepare swap. Error: ${error.message}`;
  }
}

export async function executeSwap(chainName: ChainName, params: any): Promise<string> {
  try {
    const client = getWalletClient(chainName);
    const publicClient = getPublicClient(chainName);
    const { txRequest, needsApprove, fromTokenAddress, approvalAddress, amountWei } = params;

    if (needsApprove) {
      // Auto-Approve Transaction
      const approveHash = await client.writeContract({
        account: client.account!,
        chain: client.chain,
        address: fromTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        // Max Uint256
        args: [approvalAddress as `0x${string}`, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // Execute Swap
    // @ts-ignore
    const txHash = await client.sendTransaction({
      account: client.account!,
      chain: client.chain,
      to: txRequest.to,
      data: txRequest.data,
      value: txRequest.value ? BigInt(txRequest.value) : 0n,
      gas: txRequest.gasLimit ? (BigInt(txRequest.gasLimit) * 12n / 10n) : undefined // 20% buffer
    });

    return `Swap successful. Tx Hash: ${txHash}`;
  } catch (error: any) {
    return `Failed to execute swap: ${error.message}`;
  }
}

export const swapTokenToolDefinition = {
  type: "function",
  function: {
    name: "swap_token",
    description: "Executes a decentralized token swap (DEX) to exchange one cryptocurrency for another using Li.Fi or Relay. Automatically simulates the swap to fetch quotes.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
          description: "The blockchain network",
        },
        fromToken: {
          type: "string",
          description: "The token symbol to sell (e.g., 'ETH', 'USDC')",
        },
        toToken: {
          type: "string",
          description: "The token symbol to buy (e.g., 'USDC', 'UNI')",
        },
        amountStr: {
          type: "string",
          description: "The amount of fromToken to swap",
        },
        mode: {
          type: "string",
          enum: ["auto", "manual"],
          description: "auto uses lifi. manual uses the specified provider."
        },
        providerName: {
          type: "string",
          enum: ["lifi", "relay"],
          description: "Used if mode is manual."
        }
      },
      required: ["chainName", "fromToken", "toToken", "amountStr"],
    },
  },
};
