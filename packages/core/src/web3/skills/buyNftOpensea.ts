import { safeFetchJson, HttpError } from '../../utils/httpClient';
import { getOpenSeaHeaders } from '../../config/marketConfigManager';
import { normalizeChainName } from '../utils/chains';
import { getAddress, submitTransaction } from '../utils/vaultClient';
import { txManager } from '../../agent/transactionManager';
import { loadPolicyConfig } from '../../config/parser';
import { formatEther } from 'viem';

export const buyNftOpenseaToolDefinition = {
  type: 'function',
  function: {
    name: 'buy_nft_opensea',
    description: 'Prepare and execute a transaction to buy an NFT from an OpenSea collection listing using Seaport protocol.',
    parameters: {
      type: 'object',
      properties: {
        collectionSlug: {
          type: 'string',
          description: 'The OpenSea collection slug (e.g., "pudgypenguins", "boredapeyachtclub", "azuki")'
        },
        chain: {
          type: 'string',
          description: 'EVM chain name (e.g., "ethereum", "polygon", "base", "arbitrum", "optimism", "bsc", "robinhood"). Defaults to "ethereum".'
        },
        tokenId: {
          type: 'string',
          description: 'Optional specific NFT token ID to buy. If omitted, buys the lowest price floor listing.'
        },
        contractAddress: {
          type: 'string',
          description: 'Optional NFT contract address if known.'
        }
      },
      required: ['collectionSlug']
    }
  }
};

export async function buyNftOpensea(
  collectionSlug: string,
  chain: string = 'ethereum',
  tokenId?: string,
  contractAddress?: string
): Promise<string> {
  try {
    const chainName = normalizeChainName(chain || 'ethereum');
    const slug = String(collectionSlug || '').trim().toLowerCase();
    if (!slug) {
      throw new Error('collectionSlug is required.');
    }

    const userAddress = await getAddress();
    if (!userAddress) {
      throw new Error('Could not resolve user wallet address. Vault may be locked.');
    }

    const headers = getOpenSeaHeaders();

    // 1. Fetch listing order
    let listing: any = null;
    if (tokenId && contractAddress) {
      const orderUrl = `https://api.opensea.io/api/v2/orders/${chainName}/seaport/listings?asset_contract_address=${contractAddress}&token_ids=${tokenId}&limit=1`;
      const orderData = await safeFetchJson<any>(orderUrl, { headers, timeoutMs: 15000, retries: 1 });
      if (orderData?.orders && orderData.orders.length > 0) {
        listing = orderData.orders[0];
      }
    } else {
      const bestUrl = `https://api.opensea.io/api/v2/listings/collection/${encodeURIComponent(slug)}/best`;
      listing = await safeFetchJson<any>(bestUrl, { headers, timeoutMs: 15000, retries: 1 });
    }

    if (!listing || !listing.order_hash) {
      return `[OpenSea NFT Trading] No active listing found for collection "${slug}" on chain "${chainName}".`;
    }

    const orderHash = listing.order_hash;
    const protocolAddress = listing.protocol_address || '0x0000000000000068f116a894984e2db1123eb395';

    // 2. Extract price info
    let priceWei = 0n;
    let priceSymbol = 'ETH';
    try {
      if (listing.price?.current?.value) {
        priceWei = BigInt(listing.price.current.value);
        priceSymbol = listing.price.current.currency || 'ETH';
      } else if (listing.current_price) {
        priceWei = BigInt(listing.current_price);
      }
    } catch {
      priceWei = 0n;
    }

    const priceFormatted = priceWei > 0n ? formatEther(priceWei) : 'Unknown';

    // 3. Request fulfillment calldata from OpenSea
    const fulfillUrl = `https://api.opensea.io/api/v2/listings/fulfillment_data`;
    const fulfillPayload = {
      listing: {
        hash: orderHash,
        chain: chainName,
        protocol_address: protocolAddress
      },
      fulfiller: {
        address: userAddress
      }
    };

    const fulfillRes = await safeFetchJson<any>(fulfillUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fulfillPayload),
      timeoutMs: 20000,
      retries: 1
    });

    const txData = fulfillRes?.fulfillment_data?.transaction;
    if (!txData || !txData.to) {
      return `[OpenSea NFT Trading] Failed to generate transaction fulfillment calldata from OpenSea API.`;
    }

    const targetTo = txData.to;
    const calldata = txData.input_data || txData.data || '0x';
    const valueWei = txData.value?.toString() || priceWei.toString() || '0';

    // 4. Create pending transaction with Policy Guardrail
    const tx = txManager.createPendingTransaction('nftBuy', chainName, {
      collectionSlug: slug,
      tokenId: tokenId || 'floor',
      priceFormatted,
      priceSymbol,
      amountWei: valueWei,
      to: targetTo,
      data: calldata,
      value: valueWei,
      protocol: 'seaport'
    });

    const policy = loadPolicyConfig();
    if (policy.require_approval === false) {
      const result = await executeNftBuy(chainName, tx.details, true);
      txManager.updateStatus(tx.id, 'executed', result);
      return `⚡ **NFT Buy Auto-Executed**\nI have automatically executed your NFT purchase for **${slug.toUpperCase()}** on **${chainName.toUpperCase()}** via OpenSea Seaport.\n\n- **Price:** ${priceFormatted} ${priceSymbol}\n- **Contract:** \`${targetTo}\`\n\nResult: ${result}`;
    }

    return `⚡ **NFT Purchase Prepared**\nI have prepared an on-chain transaction to purchase an NFT from collection **${slug.toUpperCase()}** on the **${chainName.toUpperCase()}** network via OpenSea Seaport.\n\n- **Token ID:** ${tokenId || 'Floor Listing'}\n- **Price:** ${priceFormatted} ${priceSymbol}\n- **Seaport Protocol:** \`${targetTo}\`\n\n*Is everything correct? Reply **Yes** to execute (will trigger wallet confirmation), or **No** to cancel.*`;
  } catch (error: any) {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403 || error.status === 429) {
        return `[OpenSea NFT Trading] API access error (HTTP ${error.status}). You can configure your OpenSea API Key from Dashboard -> Market Oracles.`;
      }
    }
    return `[OpenSea NFT Trading] Failed to prepare NFT purchase: ${error.message}`;
  }
}

export async function executeNftBuy(chainName: string, details: any, autoApprove: boolean = false): Promise<string> {
  const normChain = normalizeChainName(chainName);
  const payload = {
    type: 'nftBuy',
    chainName: normChain,
    autoApprove,
    details
  };
  return await submitTransaction(payload);
}
