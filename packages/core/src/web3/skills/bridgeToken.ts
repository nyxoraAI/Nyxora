import { parseUnits, formatUnits } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI } from '../utils/tokens';
import { loadConfig } from '../../config/parser';

const CHAIN_IDS: Record<ChainName, number> = {
  ethereum: 1,
  base: 8453,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  sepolia: 11155111,
  polygon: 137,
  base_sepolia: 84532,
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
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Relay API Error: ${err.message || res.statusText}`);
  }
  return await res.json();
}

export async function prepareBridgeToken(
  fromChainName: ChainName, 
  toChainName: ChainName, 
  fromToken: string, 
  toToken: string, 
  amountStr: string,
  mode: "auto" | "manual" = "auto",
  providerName: "lifi" | "relay" = "lifi",
  slippagePercent?: number
): Promise<string> {
  try {
    const publicClient = getPublicClient(fromChainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    const fromChainId = CHAIN_IDS[fromChainName];
    const toChainId = CHAIN_IDS[toChainName];
    
    const fromTokenAddress = resolveToken(fromToken, fromChainName);
    const toTokenAddress = resolveToken(toToken, toChainName);
    const isNativeIn = fromTokenAddress === "0x0000000000000000000000000000000000000000";

    // Get decimals
    let decimals = 18;
    if (!isNativeIn) {
      // @ts-ignore
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

    let actualSlippage = slippagePercent;
    if (actualSlippage === undefined || actualSlippage === null) {
      try {
        const config = loadConfig();
        actualSlippage = (config.agent as any).default_slippage || 0.5;
      } catch (e) {
        actualSlippage = 0.5;
      }
    }

    let actualProvider = mode === "auto" ? "lifi" : providerName;
    

    if (actualProvider === "lifi") {
      const quote = await getLifiQuote(fromChainId, toChainId, fromTokenAddress, toTokenAddress, amountWei, userAddress, actualSlippage / 100);
      txRequest = quote.transactionRequest;
      approvalAddress = quote.estimate.approvalAddress;
      
      const toDecimals = quote.action.toToken.decimals;
      expectedOutputStr = formatUnits(BigInt(quote.estimate.toAmount), toDecimals);
    } else if (actualProvider === "relay") {
      const relayQuote = await getRelayQuote(fromChainId, toChainId, fromTokenAddress, toTokenAddress, amountWei, userAddress, actualSlippage);
      if (!relayQuote.steps || relayQuote.steps.length === 0) throw new Error("No route found by Relay.");
      
      const txStep = relayQuote.steps.find((s: any) => s.id === "execute");
      if (!txStep || !txStep.items || txStep.items.length === 0) throw new Error("Relay steps invalid.");
      const item = txStep.items[0];
      txRequest = item.data;
      
      if (!isNativeIn && txRequest.to.toLowerCase() !== fromTokenAddress.toLowerCase()) {
        approvalAddress = txRequest.to;
      }
      
      expectedOutputStr = relayQuote.details?.currencyOut?.amountFormatted || "Unknown";
    }

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

    const tx = txManager.createPendingTransaction('bridge', fromChainName, { 
      txRequest, 
      needsApprove,
      fromTokenAddress,
      approvalAddress,
      amountWei
    });

    return `TRANSACTION_PENDING: Bridge simulated via ${actualProvider.toUpperCase()}. Expected Output on ${toChainName}: ~${expectedOutputStr} ${toToken.toUpperCase()}. ${needsApprove ? '(Auto-Approve required) ' : ''}Gas est: ${txRequest.gasLimit || 'auto'}. Transaction ID: ${tx.id}. Wait for user to approve.`;
  } catch (error: any) {
    return `Simulation failed! Cannot prepare bridge. Error: ${error.message}`;
  }
}

export async function executeBridge(chainName: ChainName, params: any, autoApprove: boolean = false): Promise<string> {
  try {
    const { txRequest, needsApprove, fromTokenAddress, approvalAddress, amountWei } = params;
    const token = process.env.INTERNAL_AUTH_TOKEN;

    const payload: any = {
      type: 'bridge',
      chainName,
      autoApprove,
      details: {
        txRequest, needsApprove, fromTokenAddress, approvalAddress, amountWei
      }
    };

    if (autoApprove && token) {
      const crypto = require('crypto');
      payload.internalSignature = crypto.createHmac('sha256', token).update(chainName + amountWei).digest('hex');
    }

    const res = await fetch('http://127.0.0.1:3001/request-tx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown error from Policy API');

    if (data.status === 'pending') {
      return `Transaction pending approval via Policy API. Tx ID: ${data.txId}`;
    }

    if (data.signedHash) {
      return `Bridge successfully executed on-chain! Transaction Hash: ${data.signedHash}`;
    }
    return `Bridge executed. Result: ${JSON.stringify(data)}`;
  } catch (error: any) {
    return `Failed to execute bridge: ${error.message}`;
  }
}

export const bridgeTokenToolDefinition = {
  type: "function",
  function: {
    name: "bridge_token",
    description: "Executes a cross-chain token bridge from one network to another using Li.Fi or Relay. Automatically simulates to fetch quotes.",
    parameters: {
      type: "object",
      properties: {
        fromChainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The source blockchain network",
        },
        toChainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The destination blockchain network",
        },
        fromToken: {
          type: "string",
          description: "The token symbol to sell on source chain (e.g., 'ETH', 'USDC')",
        },
        toToken: {
          type: "string",
          description: "The token symbol to buy on destination chain (e.g., 'USDC', 'UNI')",
        },
        amountStr: {
          type: "string",
          description: "The amount of fromToken to bridge",
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
        },
        slippagePercent: {
          type: "number",
          description: "Optional slippage tolerance percentage (e.g. 0.5, 5, 10). If not specified, defaults to the globally configured slippage."
        }
      },
      required: ["fromChainName", "toChainName", "fromToken", "toToken", "amountStr"],
    },
  },
};
