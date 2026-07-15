import { normalizeChainName } from '../utils/chains';
import { parseUnits } from 'viem';
import * as process from 'process';
import crypto from 'crypto';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI, getTokenMetadata } from '../utils/tokens';

export async function prepareRevokeApproval(chainName: ChainName, tokenAddressOrSymbol: string, spenderAddress: `0x${string}`): Promise<string> {
  try {
    chainName = normalizeChainName(chainName);
    if (!chainName || !tokenAddressOrSymbol || !spenderAddress) throw new Error("Missing required parameters for revoking approval.");
    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
    let tokenAddress = resolveToken(tokenAddressOrSymbol, chainName);
    if (tokenAddress === "0x0000000000000000000000000000000000000000" || tokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
        return "Cannot revoke approval for native tokens.";
    }

    const metadata = await getTokenMetadata(publicClient, tokenAddress as `0x${string}`);
    const symbol = metadata.symbol;

    // --- Pre-flight Balance Check ---
    const { validateTransactionBalances } = await import('../utils/balanceChecker');
    const balanceCheck = await validateTransactionBalances(chainName, userAddress, tokenAddress, "0");
    if (!balanceCheck.isValid) {
      throw new Error(balanceCheck.message);
    }
    // --------------------------------
    // Simulate ERC-20 Approve to 0
    let gasEstimate: bigint = 0n;
    try {
        const { request } = await publicClient.simulateContract({
            account,
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [spenderAddress, 0n],
        });
        // @ts-ignore
        gasEstimate = request.gas || 60000n;
    } catch (simError: any) {
        return `Simulation failed! Cannot prepare revoke approval. Ensure the spender address is a valid contract. Error: ${simError.message}`;
    }

    const tx = txManager.createPendingTransaction('revokeApproval', chainName, { 
      spenderAddress,
      tokenAddress, 
      symbol,
      gasEstimate: gasEstimate.toString()
    });

    return `⏳ **Revoke queued:** ${symbol} | Spender: ${spenderAddress} | ${chainName.toUpperCase()} | Please reply with 'Yes' to execute, or 'No' to cancel.`;
  } catch (error: any) {
    return `Failed to prepare revoke approval: ${error.message}`;
  }
}

import { submitTransaction } from '../utils/vaultClient';

export async function executeRevokeApproval(chainName: ChainName, params: any, autoApprove: boolean = false): Promise<string> {
  try {
    const { tokenAddress, spenderAddress, dataHex } = params;

    const payload: any = {
      type: 'revokeApproval',
      chainName,
      autoApprove,
      details: { 
        tokenAddress, 
        spenderAddress, 
        dataHex,
        amountWei: "0",
        txRequest: {
          to: tokenAddress,
          value: "0",
          data: dataHex
        }
      }
    };

    const result = await submitTransaction(payload);
    return result;
  } catch (error: any) {
    return `Failed to execute revocation: ${error.message}`;
  }
}

export const revokeApprovalToolDefinition = {
  type: "function",
  function: {
    name: "revoke_approval",
    description: "Revokes token spending allowance (sets allowance to 0) for a specific smart contract (spender). Use this to secure the user's wallet from malicious or vulnerable dApps.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The name of the blockchain."
        },
        tokenAddressOrSymbol: {
          type: "string",
          description: "The token symbol (e.g. USDC, PEPE) or contract address to revoke."
        },
        spenderAddress: {
          type: "string",
          description: "The destination 0x... smart contract address to revoke access from."
        }
      },
      required: ["chainName", "tokenAddressOrSymbol", "spenderAddress"]
    }
  }
};
