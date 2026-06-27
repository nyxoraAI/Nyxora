import { formatEther, formatUnits } from 'viem';
import { getPublicClient, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { ERC20_ABI, resolveToken, getTokenMetadata } from '../utils/tokens';
import { saveTokenToWhitelist } from '../../utils/userWhitelistManager';

export async function getBalance(chainName: ChainName, address?: `0x${string}`, token?: string): Promise<string> {
  try {
    const client = getPublicClient(chainName);
    
    let targetAddress = address;
    if (!targetAddress) {
      const { getAddress } = await import('../config');
      targetAddress = (await getAddress()) as `0x${string}`;
    }

    if (!targetAddress) {
      throw new Error('Address is required but could not be resolved from private key.');
    }

    if (token) {
      const tokenAddress = resolveToken(token, chainName);
      if (tokenAddress === "0x0000000000000000000000000000000000000000" || tokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
        const balanceWei = await client.getBalance({ address: targetAddress as `0x${string}` });
        const balanceEth = formatEther(balanceWei);
        return `${balanceEth} on ${chainName}`;
      } else {
        // Intercept and save custom ERC20 token to user's whitelist
        saveTokenToWhitelist(targetAddress, chainName, tokenAddress);

        const [balanceWei, metadata] = await Promise.all([
          // @ts-ignore
          client.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [targetAddress as `0x${string}`],
          }) as Promise<bigint>,
          getTokenMetadata(client, tokenAddress as `0x${string}`)
        ]);
        
        const balanceFormatted = formatUnits(balanceWei, metadata.decimals);
        return `${balanceFormatted} ${metadata.symbol} on ${chainName}`;
      }
    } else {
      const balanceWei = await client.getBalance({ address: targetAddress as `0x${string}` });
      const balanceEth = formatEther(balanceWei);
      return `${balanceEth} on ${chainName}`;
    }
  } catch (error: any) {
    return `Failed to get balance: ${error.message}`;
  }
}

export const getBalanceToolDefinition = {
  type: "function",
  function: {
    name: "get_balance",
    description: "Get the native or ERC-20 token balance of a wallet address on a specific chain. If address is omitted, it returns the balance of the agent's own wallet.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The blockchain network"
        },
        address: {
          type: "string",
          description: "Optional. The 0x... address of the wallet. If not provided, it uses the agent's wallet."
        },
        token: {
          type: "string",
          description: "Optional. The token symbol (e.g. USDC, USDT, WETH) or contract address (0x...) to check. If omitted, checks the native coin (ETH/BNB)."
        }
      },
      required: ["chainName"]
    }
  }
};
