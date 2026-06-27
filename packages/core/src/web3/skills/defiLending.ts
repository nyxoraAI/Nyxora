import { parseUnits } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI, getTokenMetadata } from '../utils/tokens';

// Aave V3 Pool ABI snippet for Supply
const AAVE_POOL_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "address", "name": "onBehalfOf", "type": "address" },
      { "internalType": "uint16", "name": "referralCode", "type": "uint16" }
    ],
    "name": "supply",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Simplified mapping for Aave V3 Pool addresses (normally fetched dynamically from PoolAddressesProvider)
const AAVE_V3_POOLS: Record<string, `0x${string}`> = {
  ethereum: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  arbitrum: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  optimism: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  polygon: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  base: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  sepolia: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"
};

export async function prepareAaveSupply(chainName: ChainName, tokenAddressOrSymbol: string, amountStr: string): Promise<string> {
  try {
    if (!chainName || !tokenAddressOrSymbol || !amountStr) throw new Error("Missing protocol/chain/token parameters for DeFi operation.");
    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
    const poolAddress = AAVE_V3_POOLS[chainName];
    if (!poolAddress) {
        return `Error: Aave V3 is not officially supported or mapped by Nyxora on the ${chainName} network.`;
    }

    let tokenAddress = resolveToken(tokenAddressOrSymbol, chainName);
    if (tokenAddress === "0x0000000000000000000000000000000000000000" || tokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
        return "Error: Cannot supply native ETH/BNB directly. Please provide WETH or a valid ERC-20 token.";
    }

    const metadata = await getTokenMetadata(publicClient, tokenAddress as `0x${string}`);
    const amountWei = parseUnits(amountStr, metadata.decimals);

    // 1. Check Allowance first
    const allowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account, poolAddress]
    } as any) as bigint;

    let needsApproval = allowance < amountWei;

    if (needsApproval) {
        // Prepare an approval transaction instead
        const tx = txManager.createPendingTransaction('approve', chainName, { 
            spenderAddress: poolAddress,
            tokenAddress, 
            amountStr,
            symbol: metadata.symbol,
            gasEstimate: "60000"
        });
        return `⏳ **Approve queued:** ${metadata.symbol} | For: Aave V3 | ${chainName.toUpperCase()} | Approve below.`;
    }

    // 2. Simulate Supply
    let gasEstimate: bigint = 0n;
    try {
        const { request } = await publicClient.simulateContract({
            account,
            address: poolAddress,
            abi: AAVE_POOL_ABI,
            functionName: 'supply',
            args: [tokenAddress, amountWei, account, 0],
        });
        // @ts-ignore
        gasEstimate = request.gas || 300000n;
    } catch (simError: any) {
        return `Simulation failed! Cannot supply to Aave. Error: ${simError.message}`;
    }

    const tx = txManager.createPendingTransaction('aaveSupply', chainName, { 
      poolAddress,
      tokenAddress, 
      amountStr,
      symbol: metadata.symbol,
      gasEstimate: gasEstimate.toString()
    });

    return `⏳ **Aave Supply queued:** ${amountStr} ${metadata.symbol} | ${chainName.toUpperCase()} | Approve below.`;
  } catch (error: any) {
    return `Failed to prepare Aave supply: ${error.message}`;
  }
}

export const aaveSupplyToolDefinition = {
  type: "function",
  function: {
    name: "supply_aave",
    description: "Supply (deposit) an ERC-20 asset like USDC or WETH into the Aave V3 lending protocol to earn yield/interest.",
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
          description: "The token symbol (e.g. USDC, WETH) to supply."
        },
        amountStr: {
          type: "string",
          description: "The amount of tokens to supply (e.g. '100')."
        }
      },
      required: ["chainName", "tokenAddressOrSymbol", "amountStr"]
    }
  }
};
