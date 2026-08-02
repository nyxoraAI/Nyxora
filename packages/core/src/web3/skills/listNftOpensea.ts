import { safeFetchJson, HttpError } from '../../utils/httpClient';
import { getOpenSeaHeaders } from '../../config/marketConfigManager';
import { normalizeChainName } from '../utils/chains';
import { getAddress, submitTransaction } from '../utils/vaultClient';
import { txManager } from '../../agent/transactionManager';
import { loadPolicyConfig } from '../../config/parser';
import { getPublicClient } from '../utils/rpcEngine';
import { parseEther, encodeFunctionData } from 'viem';

// Seaport v1.5 / Conduit address commonly used by OpenSea
const SEAPORT_CONDUIT_ADDRESS = '0x1E0049783F008A0085193E00003D00cd54003c71';

const ERC721_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' }
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' }
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

export const listNftOpenseaToolDefinition = {
  type: 'function',
  function: {
    name: 'list_nft_opensea',
    description: 'Prepare an NFT listing for sale on OpenSea (Seaport protocol), checking ERC-721/ERC-1155 approval and submitting listing order.',
    parameters: {
      type: 'object',
      properties: {
        contractAddress: {
          type: 'string',
          description: 'The NFT contract address'
        },
        tokenId: {
          type: 'string',
          description: 'The token ID of the NFT to list'
        },
        priceEth: {
          type: 'string',
          description: 'The listing price in ETH or native currency (e.g. "0.25")'
        },
        chain: {
          type: 'string',
          description: 'EVM chain name (e.g., "ethereum", "polygon", "base", "arbitrum", "optimism", "bsc", "robinhood"). Defaults to "ethereum".'
        },
        expirationDays: {
          type: 'number',
          description: 'Number of days until listing expires (default: 30)'
        }
      },
      required: ['contractAddress', 'tokenId', 'priceEth']
    }
  }
};

export async function listNftOpensea(
  contractAddress: string,
  tokenId: string,
  priceEth: string,
  chain: string = 'ethereum',
  expirationDays: number = 30
): Promise<string> {
  try {
    const chainName = normalizeChainName(chain || 'ethereum');
    if (!contractAddress || !tokenId || !priceEth) {
      throw new Error('contractAddress, tokenId, and priceEth are required.');
    }

    const userAddress = await getAddress();
    if (!userAddress) {
      throw new Error('Could not resolve user wallet address. Vault may be locked.');
    }

    const priceWei = parseEther(priceEth || '0');
    if (priceWei <= 0n) {
      throw new Error('Listing price must be greater than 0.');
    }

    const client = getPublicClient(chainName);

    // 1. Check if user has approved OpenSea Seaport Conduit
    let isApproved = false;
    try {
      isApproved = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: ERC721_ABI,
        functionName: 'isApprovedForAll',
        args: [userAddress as `0x${string}`, SEAPORT_CONDUIT_ADDRESS]
      } as any) as boolean;
    } catch {
      // If contract read fails, we assume not approved and prepare approval
      isApproved = false;
    }

    // 2. If not approved, prepare setApprovalForAll transaction via Policy Guardrail
    if (!isApproved) {
      const approvalData = encodeFunctionData({
        abi: ERC721_ABI,
        functionName: 'setApprovalForAll',
        args: [SEAPORT_CONDUIT_ADDRESS, true]
      });

      const tx = txManager.createPendingTransaction('nftList', chainName, {
        contractAddress,
        tokenId,
        priceEth,
        action: 'setApprovalForAll',
        to: contractAddress,
        data: approvalData,
        value: '0',
        amountWei: '0'
      });

      const policy = loadPolicyConfig();
      if (policy.require_approval === false) {
        const result = await executeNftList(chainName, tx.details, true);
        txManager.updateStatus(tx.id, 'executed', result);
        return `⚡ **NFT Listing Approval Auto-Executed**\nI have automatically submitted the Seaport approval transaction for NFT contract \`${contractAddress}\` on **${chainName.toUpperCase()}**.\n\nOnce confirmed, your NFT #${tokenId} will be ready to list at **${priceEth} ETH**.\n\nResult: ${result}`;
      }

      return `⚡ **NFT Listing Approval Required**\nBefore listing token #${tokenId} at **${priceEth} ETH** on OpenSea, your wallet must grant Seaport approval for contract \`${contractAddress}\` on **${chainName.toUpperCase()}**.\n\n*Is everything correct? Reply **Yes** to approve (will trigger wallet confirmation), or **No** to cancel.*`;
    }

    // 3. If already approved, prepare Seaport listing parameters
    const expirationTimestamp = Math.floor(Date.now() / 1000) + (expirationDays * 86400);

    const listingSummary = [
      `=== OPENSEA SEAPORT LISTING PREPARED ===`,
      `Chain          : ${chainName.toUpperCase()}`,
      `Contract       : ${contractAddress}`,
      `Token ID       : #${tokenId}`,
      `Listing Price  : ${priceEth} ETH`,
      `Expires In     : ${expirationDays} days`,
      `Status         : Approved for OpenSea Seaport`,
      `==========================================`,
      `To finalize the off-chain listing signature, please confirm signature in your wallet.`
    ].join('\n');

    return listingSummary;
  } catch (error: any) {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403 || error.status === 429) {
        return `[OpenSea NFT Trading] API access error (HTTP ${error.status}). You can configure your OpenSea API Key from Dashboard -> Market Oracles.`;
      }
    }
    return `[OpenSea NFT Trading] Failed to prepare NFT listing: ${error.message}`;
  }
}

export async function executeNftList(chainName: string, details: any, autoApprove: boolean = false): Promise<string> {
  const normChain = normalizeChainName(chainName);
  const payload = {
    type: 'nftList',
    chainName: normChain,
    autoApprove,
    details
  };
  return await submitTransaction(payload);
}
