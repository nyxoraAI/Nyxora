import { parseUnits } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI, getTokenMetadata } from '../utils/tokens';

// Generic Auto-Compounder Vault ABI (Works for Beefy and most Yearn V2/V3 vaults)
const VAULT_ABI = [
  {
    "inputs": [],
    "name": "depositAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export async function prepareVaultDeposit(chainName: ChainName, protocol: string, vaultAddress: `0x${string}`, tokenAddressOrSymbol: string, amountStr: string): Promise<string> {
  try {
    if (!chainName || !vaultAddress || !tokenAddressOrSymbol || !amountStr) throw new Error("Missing protocol/chain/token parameters for DeFi operation.");
    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
    let tokenAddress = resolveToken(tokenAddressOrSymbol, chainName);
    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
        return "Error: Cannot deposit native token directly into Vaults. Please wrap it first (e.g. WETH).";
    }

    const metadata = await getTokenMetadata(publicClient, tokenAddress as `0x${string}`);
    const amountWei = parseUnits(amountStr, metadata.decimals);

    // 1. Check Allowance
    const allowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account, vaultAddress]
    } as any) as bigint;

    let needsApproval = allowance < amountWei;

    if (needsApproval) {
        const tx = txManager.createPendingTransaction('approve', chainName, { 
            spenderAddress: vaultAddress,
            tokenAddress, 
            amountStr,
            symbol: metadata.symbol,
            gasEstimate: "60000"
        });
        return `⏳ **Approve queued:** ${metadata.symbol} | For: ${protocol.toUpperCase()} Vault | ${chainName.toUpperCase()} | Approve below.`;
    }

    // 2. Simulate Deposit
    let gasEstimate: bigint = 0n;
    try {
        const { request } = await publicClient.simulateContract({
            account,
            address: vaultAddress,
            abi: VAULT_ABI,
            functionName: 'deposit',
            args: [amountWei],
        });
        // @ts-ignore
        gasEstimate = request.gas || 400000n;
    } catch (simError: any) {
        return `Simulation failed! Cannot deposit to ${protocol} Vault. Ensure the vault address matches the token. Error: ${simError.message}`;
    }

    const tx = txManager.createPendingTransaction('vaultDeposit', chainName, { 
      vaultAddress,
      tokenAddress, 
      amountStr,
      symbol: metadata.symbol,
      protocol,
      gasEstimate: gasEstimate.toString()
    });

    return `⏳ **Vault Deposit queued:** ${amountStr} ${metadata.symbol} | ${protocol.toUpperCase()} | ${chainName.toUpperCase()} | Approve below.`;
  } catch (error: any) {
    return `Failed to prepare Vault deposit: ${error.message}`;
  }
}

export const vaultDepositToolDefinition = {
  type: "function",
  function: {
    name: "deposit_yield_vault",
    description: "Deposit an ERC-20 or LP token into an Auto-Compounder Vault (Primary: Beefy Finance, Secondary: Yearn Finance).",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The name of the blockchain."
        },
        protocol: {
          type: "string",
          enum: ["beefy", "yearn"],
          description: "The protocol to use. Default to beefy unless user asks for yearn."
        },
        vaultAddress: {
          type: "string",
          description: "The exact 0x... address of the Beefy or Yearn Vault."
        },
        tokenAddressOrSymbol: {
          type: "string",
          description: "The token symbol (e.g. USDC, WETH) to deposit."
        },
        amountStr: {
          type: "string",
          description: "The amount of tokens to deposit (e.g. '100')."
        }
      },
      required: ["chainName", "protocol", "vaultAddress", "tokenAddressOrSymbol", "amountStr"]
    }
  }
};
