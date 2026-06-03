import { parseEther, parseUnits } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI } from '../utils/tokens';

export async function prepareTransfer(chainName: ChainName, toAddress: `0x${string}`, amountStr: string, token?: string): Promise<string> {
  try {
    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
    let tokenAddress = "0x0000000000000000000000000000000000000000";
    let isNative = true;
    let decimals = 18;
    let symbol = "ETH/BNB"; // Generic fallback for native

    if (token) {
      tokenAddress = resolveToken(token, chainName);
      isNative = tokenAddress === "0x0000000000000000000000000000000000000000";
    }

    let gasEstimate: bigint = 0n;

    if (isNative) {
      // Simulate Native Transfer
      const value = parseEther(amountStr);
      gasEstimate = await publicClient.estimateGas({
        account,
        to: toAddress,
        value,
      });
    } else {
      // Simulate ERC-20 Transfer
      // @ts-ignore
      decimals = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as number;

      // @ts-ignore
      symbol = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }).catch(() => token || "TOKEN") as string;

      const value = parseUnits(amountStr, decimals);
      
      const { request } = await publicClient.simulateContract({
        account,
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [toAddress, value],
      });
      // @ts-ignore
      gasEstimate = request.gas || 50000n; 
    }

    const tx = txManager.createPendingTransaction('transfer', chainName, { 
      toAddress, 
      amountStr, 
      tokenAddress, 
      isNative, 
      decimals,
      gasEstimate: gasEstimate.toString()
    });

    const tokenName = isNative ? "Native Token" : symbol;
    return `TRANSACTION_PENDING: I have prepared the ${tokenName} transfer and simulated it successfully. Estimated gas units: ${gasEstimate}. Transaction ID: ${tx.id}. Wait for user to approve.`;
  } catch (error: any) {
    return `Simulation failed! Cannot prepare transfer. Error: ${error.message}`;
  }
}

export async function executeTransfer(chainName: ChainName, params: any, autoApprove: boolean = false): Promise<string> {
  try {
    const { toAddress, amountStr, tokenAddress, isNative, decimals } = params;
    const token = process.env.INTERNAL_AUTH_TOKEN;

    const payload = {
      type: 'transfer',
      chainName,
      autoApprove,
      details: {
        toAddress, amountStr, tokenAddress, isNative, decimals
      }
    };

    const res = await fetch('http://127.0.0.1:3001/request-tx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown error from Policy API');

    if (data.status === 'pending') {
      return `Transaction pending approval via Policy API. Tx ID: ${data.txId}`;
    }

    return `Transaction executed. Result: ${JSON.stringify(data)}`;
  } catch (error: any) {
    return `Failed to execute transfer: ${error.message}`;
  }
}

export const transferToolDefinition = {
  type: "function",
  function: {
    name: "transfer_token",
    description: "Transfer native tokens (ETH, BNB, etc.) or ERC-20 tokens from the agent's wallet to a destination address. Automatically performs on-chain simulation before requesting user approval.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The name of the blockchain to execute the transfer on."
        },
        toAddress: {
          type: "string",
          description: "The destination 0x... wallet address."
        },
        amountStr: {
          type: "string",
          description: "The amount of tokens to send (e.g. '0.01')."
        },
        token: {
          type: "string",
          description: "Optional. The token symbol (e.g. USDC, USDT) or contract address (0x...). If omitted, sends the native coin."
        }
      },
      required: ["chainName", "toAddress", "amountStr"]
    }
  }
};
