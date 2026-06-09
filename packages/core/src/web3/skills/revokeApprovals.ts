import { parseUnits } from 'viem';
import * as process from 'process';
import crypto from 'crypto';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI, getTokenMetadata } from '../utils/tokens';

export async function prepareRevokeApproval(chainName: ChainName, tokenAddressOrSymbol: string, spenderAddress: `0x${string}`): Promise<string> {
  try {
    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
    let tokenAddress = resolveToken(tokenAddressOrSymbol, chainName);
    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
        return "Cannot revoke approval for native tokens.";
    }

    const metadata = await getTokenMetadata(publicClient, tokenAddress as `0x${string}`);
    const symbol = metadata.symbol;

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

    return `TRANSACTION_PENDING: I have prepared the Revoke Approval transaction for ${symbol} to block spender ${spenderAddress}. Estimated gas units: ${gasEstimate}. Transaction ID: ${tx.id}. Wait for user to approve on the Dashboard.`;
  } catch (error: any) {
    return `Failed to prepare revoke approval: ${error.message}`;
  }
}

export async function executeRevokeApproval(chainName: ChainName, params: any, autoApprove: boolean = false): Promise<string> {
  try {
    const { spenderAddress, tokenAddress } = params;
    const token = process.env.INTERNAL_AUTH_TOKEN;

    const payload: any = {
      type: 'custom_contract',
      chainName,
      autoApprove,
      details: {
        contractAddress: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, "0"],
        value: "0"
      }
    };

    if (autoApprove && token) {
      payload.internalSignature = crypto.createHmac('sha256', token).update(chainName + JSON.stringify(payload.details)).digest('hex');
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
      return `Revoke successfully executed on-chain! Transaction Hash: ${data.signedHash}`;
    }
    return `Transaction executed. Result: ${JSON.stringify(data)}`;
  } catch (error: any) {
    return `Failed to execute revoke: ${error.message}`;
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
