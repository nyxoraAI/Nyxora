import { parseEther, parseUnits, encodeFunctionData } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI, getTokenMetadata } from '../utils/tokens';
import { submitTransaction } from '../utils/vaultClient';

export async function prepareTransfer(chainName: ChainName, toAddress: `0x${string}`, amountStr: string, token?: string): Promise<string> {
  try {
    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
    if (toAddress === "0x0000000000000000000000000000000000000000") {
        return `Error: You cannot transfer assets to the Zero Address (burn). For security reasons, this action is blocked.`;
    }
    
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
      // Fast-path for EOA Native Transfers (ZK-Aware)
      const code = await publicClient.getCode({ address: toAddress }).catch(() => null);
      if (!code || code === '0x') {
        gasEstimate = 21000n;
      } else {
        // Simulate Native Transfer for contracts
        const value = parseEther(amountStr);
        gasEstimate = await publicClient.estimateGas({
          account,
          to: toAddress,
          value,
        });
      }
    } else {
      // Simulate ERC-20 Transfer
      const metadata = await getTokenMetadata(publicClient, tokenAddress as `0x${string}`);
      decimals = metadata.decimals;
      symbol = metadata.symbol;

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
    return `⏳ **Transfer queued:** ${amountStr} ${tokenName} | ${chainName.toUpperCase()} ➡️ ${toAddress} | Approve below.`;
  } catch (error: any) {
    return `Simulation failed! Cannot prepare transfer. Error: ${error.message}`;
  }
}

export async function executeTransfer(chainName: ChainName, params: any, autoApprove: boolean = false): Promise<string> {
  try {
    const { toAddress, amountStr, tokenAddress, isNative, decimals } = params;
    const amountWei = isNative ? parseEther(amountStr).toString() : parseUnits(amountStr, decimals).toString();

    let txRequest: any = {};
    if (isNative) {
      txRequest = {
        to: toAddress,
        value: amountWei,
        data: "0x"
      };
    } else {
      txRequest = {
        to: tokenAddress,
        value: "0",
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [toAddress as `0x${string}`, BigInt(amountWei)]
        })
      };
    }

    const payload: any = {
      type: 'transfer',
      chainName,
      autoApprove,
      details: { ...params, txRequest }
    };

    return await submitTransaction(payload);
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
