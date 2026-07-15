import { formatUnits } from 'viem';
import { getPublicClient } from './rpcEngine';
import { ERC20_ABI, getTokenMetadata } from './tokens';
import { ChainName } from './chains';

/**
 * Validates if the user has enough balances to execute a transaction.
 * Uses a Buffer-Based approach to ensure enough Native gas token exists for ERC20 transfers.
 */
export async function validateTransactionBalances(
  chainName: ChainName,
  userAddress: string,
  tokenAddress: string,
  amountWei: string
): Promise<{ isValid: boolean; message?: string }> {
  try {
    const client = getPublicClient(chainName);
    const amount = BigInt(amountWei);

    const isNative = 
      tokenAddress.toLowerCase() === "0x0000000000000000000000000000000000000000" || 
      tokenAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

    const nativeBalance = await client.getBalance({ address: userAddress as `0x${string}` });

    if (isNative) {
      if (nativeBalance < amount) {
        const formattedAmount = formatUnits(amount, 18);
        return {
          isValid: false,
          message: `Insufficient Native Balance on ${chainName.toUpperCase()}. You need at least ${formattedAmount} Native Coin.`
        };
      }
      return { isValid: true };
    } else {
      // It's an ERC20 Token. We check token balance AND native gas buffer.
      const tokenBalance = await client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`]
      } as any) as bigint;

      if (tokenBalance < amount) {
        const meta = await getTokenMetadata(client, tokenAddress as `0x${string}`);
        const formattedAmount = formatUnits(amount, meta.decimals);
        return {
          isValid: false,
          message: `Insufficient Token Balance. You need at least ${formattedAmount} ${meta.symbol} to execute this transaction.`
        };
      }

      // Check Native Gas Buffer (minimum > 0)
      if (nativeBalance === BigInt(0)) {
        return {
          isValid: false,
          message: `Insufficient Gas. You do not have any Native Coin to pay for network fees on ${chainName.toUpperCase()}.`
        };
      }

      return { isValid: true };
    }
  } catch (error: any) {
    console.error('[BalanceChecker] Error validating balances:', error);
    // If the check fails (e.g., RPC error), we allow it to pass so we don't completely block the user if the RPC is just glitching.
    return { isValid: true };
  }
}
