import { parseUnits, formatUnits } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI } from '../utils/tokens';
import { saveTokenToWhitelist } from '../../utils/userWhitelistManager';
import { loadConfig } from '../../config/parser';
import * as crypto from 'crypto';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  sepolia: 11155111,
  polygon: 137,
};

async function getLifiQuote(fromChainId: number, toChainId: number, fromToken: string, toToken: string, amountWei: string, userAddress: string, slippage: number, providerName?: string) {
  const url = new URL('https://li.quest/v1/quote');
  url.searchParams.append('fromChain', fromChainId.toString());
  url.searchParams.append('toChain', toChainId.toString());
  url.searchParams.append('fromToken', fromToken);
  url.searchParams.append('toToken', toToken);
  url.searchParams.append('fromAmount', amountWei);
  url.searchParams.append('fromAddress', userAddress);
  url.searchParams.append('slippage', slippage.toString());
  
  // Specific Exchange forcing (Native-feel integration via Aggregator constraint)
  if (providerName && providerName !== 'lifi' && providerName !== 'auto') {
    // Map our internal names to Li.Fi exchange names
    const exchangeMap: Record<string, string> = {
      'uniswap_v2': 'uniswap_v2',
      'uniswap_v3': 'uniswap_v3',
      'pancakeswap': 'pancakeswap',
      '1inch': 'oneinch',
      'cowswap': 'cowswap'
    };
    if (exchangeMap[providerName]) {
      url.searchParams.append('allowExchanges', exchangeMap[providerName]);
    }
  }

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Li.Fi API Error: ${err.message || res.statusText}`);
  }
  return await res.json();
}

async function getRelayQuote(fromChainId: number, toChainId: number, fromToken: string, toToken: string, amountWei: string, userAddress: string, slippagePercent: number) {
  const isTestnet = fromChainId === 11155111 || toChainId === 11155111;
  const baseUrl = isTestnet ? "https://api.testnets.relay.link" : "https://api.relay.link";

  const body = {
    user: userAddress,
    originChainId: fromChainId,
    destinationChainId: toChainId,
    originCurrency: fromToken,
    destinationCurrency: toToken,
    amount: amountWei,
    tradeType: "EXACT_INPUT",
    slippageTolerance: (slippagePercent / 100).toString()
  };

  const res = await fetch(`${baseUrl}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
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
  providerName: "auto" | "lifi" | "relay" | "uniswap_v2" | "uniswap_v3" | "pancakeswap" | "1inch" | "cowswap" = "auto",
  slippagePercent?: number
): Promise<string> {
  try {
    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const chainId = CHAIN_IDS[chainName];
    
    const fromTokenAddress = resolveToken(fromToken, chainName);
    const toTokenAddress = resolveToken(toToken, chainName);
    const isNativeIn = fromTokenAddress === "0x0000000000000000000000000000000000000000";

    // Auto-save to Degen Whitelist
    if (fromTokenAddress !== "0x0000000000000000000000000000000000000000") {
      saveTokenToWhitelist(userAddress, chainName, fromTokenAddress);
    }
    if (toTokenAddress !== "0x0000000000000000000000000000000000000000") {
      saveTokenToWhitelist(userAddress, chainName, toTokenAddress);
    }

    // Get decimals
    let decimals = 18;
    if (!isNativeIn) {
      const { getTokenMetadata } = await import('../utils/tokens');
      const metadata = await getTokenMetadata(publicClient, fromTokenAddress as `0x${string}`);
      decimals = metadata.decimals;
    }
    const amountWei = parseUnits(amountStr, decimals).toString();

    let txRequest: any = null;
    let approvalAddress: string | null = null;
    let expectedOutputStr = "";

    let actualSlippage = slippagePercent;
    if (actualSlippage === undefined || actualSlippage === null) {
      try {
        const config = loadConfig();
        actualSlippage = (config.agent as any).default_slippage || 0.5;
      } catch (e) {
        actualSlippage = 0.5;
      }
    }

    // If auto, read from global configuration set by Dashboard UI
    let actualProvider = mode === "auto" ? "auto" : providerName;
    if (actualProvider === "auto") {
      try {
        const config = loadConfig();
        actualProvider = (config.agent.default_router as any) || "lifi";
        if (actualProvider === "auto") actualProvider = "lifi"; // strict fallback
      } catch (e) {
        actualProvider = "lifi";
      }
    }
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

    if (actualProvider === "relay") {
      const relayQuote = await getRelayQuote(chainId, chainId, fromTokenAddress, toTokenAddress, amountWei, userAddress, actualSlippage);
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
    } else {
      // Use Li.Fi for lifi, 1inch, cowswap, uniswap_v2, uniswap_v3, pancakeswap
      // We mapped the allowExchanges inside getLifiQuote
      const quote = await getLifiQuote(chainId, chainId, fromTokenAddress, toTokenAddress, amountWei, userAddress, actualSlippage / 100, actualProvider);
      txRequest = quote.transactionRequest;
      approvalAddress = quote.estimate.approvalAddress;
      
      const toDecimals = quote.action.toToken.decimals;
      expectedOutputStr = formatUnits(BigInt(quote.estimate.toAmount), toDecimals);
    }

    // Check allowance early so we know if we need to auto-approve
    let needsApprove = false;
    if (!isNativeIn && approvalAddress && approvalAddress !== "0x0000000000000000000000000000000000000000") {
      // @ts-ignore
      const allowance = await publicClient.readContract({
        address: fromTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress as `0x${string}`, approvalAddress as `0x${string}`],
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

export async function executeSwap(chainName: ChainName, params: any, autoApprove: boolean = false): Promise<string> {
  try {
    const { txRequest, needsApprove, fromTokenAddress, approvalAddress, amountWei } = params;
    const token = process.env.INTERNAL_AUTH_TOKEN;

    const payload: any = {
      type: 'swap',
      chainName,
      autoApprove,
      details: {
        txRequest,
        needsApprove,
        fromTokenAddress,
        approvalAddress,
        amountWei
      }
    };

    if (autoApprove && token) {
      // Generate internal HMAC signature for autoApprove bypass
      // using the transaction chainName as a quick deterministic unique string
      // In a real scenario, use a specific txId or nonce.
      payload.internalSignature = crypto.createHmac('sha256', token).update(chainName + amountWei).digest('hex');
    }

    const res = await fetch(`http://127.0.0.1:${process.env.POLICY_PORT || 3001}/request-tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown error from Policy API');

    if (data.status === 'pending') {
      return `Transaction pending approval via Policy API. Tx ID: ${data.txId}`;
    }

    if (data.signedHash) {
      return `Swap successfully executed on-chain! Transaction Hash: ${data.signedHash}`;
    }
    return `Swap executed. Result: ${JSON.stringify(data)}`;
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
          enum: SUPPORTED_CHAIN_NAMES,
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
          description: "auto uses default router. manual uses the specified provider."
        },
        providerName: {
          type: "string",
          enum: ["auto", "lifi", "relay", "uniswap_v2", "uniswap_v3", "pancakeswap", "1inch", "cowswap"],
          description: "Used if mode is manual."
        },
        slippagePercent: {
          type: "number",
          description: "Optional slippage tolerance percentage (e.g. 0.5, 5, 10). If not specified, defaults to the globally configured slippage."
        }
      },
      required: ["chainName", "fromToken", "toToken", "amountStr"],
    },
  },
};
