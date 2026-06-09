import { parseUnits } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI, getTokenMetadata } from '../utils/tokens';

// Uniswap V3 NonfungiblePositionManager ABI (Minting LP)
const UNIV3_POSITION_MANAGER_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "token0", "type": "address" },
          { "internalType": "address", "name": "token1", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "int24", "name": "tickLower", "type": "int24" },
          { "internalType": "int24", "name": "tickUpper", "type": "int24" },
          { "internalType": "uint256", "name": "amount0Desired", "type": "uint256" },
          { "internalType": "uint256", "name": "amount1Desired", "type": "uint256" },
          { "internalType": "uint256", "name": "amount0Min", "type": "uint256" },
          { "internalType": "uint256", "name": "amount1Min", "type": "uint256" },
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "internalType": "struct INonfungiblePositionManager.MintParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "mint",
    "outputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "uint128", "name": "liquidity", "type": "uint128" },
      { "internalType": "uint256", "name": "amount0", "type": "uint256" },
      { "internalType": "uint256", "name": "amount1", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
];

// Mappings for NonfungiblePositionManager
const POSITION_MANAGERS: Record<string, `0x${string}`> = {
  ethereum: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  arbitrum: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  optimism: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  base: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
  polygon: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  bsc: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364" // PancakeSwap V3 Position Manager
};

export async function prepareProvideLiquidity(
    chainName: ChainName, 
    token0AddressOrSymbol: string, 
    token1AddressOrSymbol: string, 
    amount0Str: string,
    amount1Str: string,
    feeTier: number,
    tickLower?: number,
    tickUpper?: number
): Promise<string> {
  try {
    // CRITICAL SAFETY REQUIREMENT: AI MUST ASK USER FOR TICKS
    if (tickLower === undefined || tickUpper === undefined) {
        return `ACTION REQUIRED: I cannot calculate the Uniswap V3 price range (tickLower and tickUpper) autonomously for safety reasons. Please ask the user to provide the exact tickLower and tickUpper values they want for this liquidity pool before I can prepare the transaction.`;
    }

    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
    const positionManagerAddress = POSITION_MANAGERS[chainName];
    if (!positionManagerAddress) {
        return `Error: Uniswap V3 Position Manager is not mapped for ${chainName}.`;
    }

    let token0Addr = resolveToken(token0AddressOrSymbol, chainName) as `0x${string}`;
    let token1Addr = resolveToken(token1AddressOrSymbol, chainName) as `0x${string}`;
    
    if (token0Addr === "0x0000000000000000000000000000000000000000" || token1Addr === "0x0000000000000000000000000000000000000000") {
        return "Error: Cannot provide native ETH directly to V3. Must wrap to WETH first.";
    }

    // Uniswap requires token0 to be lexicographically smaller than token1
    let token0: `0x${string}`;
    let token1: `0x${string}`;
    let amount0: string;
    let amount1: string;

    if (token0Addr.toLowerCase() < token1Addr.toLowerCase()) {
        token0 = token0Addr;
        token1 = token1Addr;
        amount0 = amount0Str;
        amount1 = amount1Str;
    } else {
        token0 = token1Addr;
        token1 = token0Addr;
        amount0 = amount1Str;
        amount1 = amount0Str;
    }

    const meta0 = await getTokenMetadata(publicClient, token0);
    const meta1 = await getTokenMetadata(publicClient, token1);

    const amount0Wei = parseUnits(amount0, meta0.decimals);
    const amount1Wei = parseUnits(amount1, meta1.decimals);

    // 1. Check Allowances for BOTH tokens
    const allowance0 = await publicClient.readContract({
        address: token0, abi: ERC20_ABI, functionName: 'allowance', args: [account, positionManagerAddress]
    } as any) as bigint;

    const allowance1 = await publicClient.readContract({
        address: token1, abi: ERC20_ABI, functionName: 'allowance', args: [account, positionManagerAddress]
    } as any) as bigint;

    if (allowance0 < amount0Wei) {
        const tx = txManager.createPendingTransaction('approve', chainName, { spenderAddress: positionManagerAddress, tokenAddress: token0, amountStr: amount0, symbol: meta0.symbol, gasEstimate: "60000" });
        return `TRANSACTION_PENDING: You need to approve Uniswap V3 to spend your ${meta0.symbol}. ID: ${tx.id}. Please approve on Dashboard first.`;
    }

    if (allowance1 < amount1Wei) {
        const tx = txManager.createPendingTransaction('approve', chainName, { spenderAddress: positionManagerAddress, tokenAddress: token1, amountStr: amount1, symbol: meta1.symbol, gasEstimate: "60000" });
        return `TRANSACTION_PENDING: You need to approve Uniswap V3 to spend your ${meta1.symbol}. ID: ${tx.id}. Please approve on Dashboard first.`;
    }

    // 2. Simulate Mint
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 mins
    
    // amountMin set to 0 for simplicity in bot context (relying on UI confirmation)
    const mintParams = {
        token0, token1, fee: feeTier, tickLower, tickUpper,
        amount0Desired: amount0Wei, amount1Desired: amount1Wei,
        amount0Min: 0n, amount1Min: 0n,
        recipient: account, deadline
    };

    let gasEstimate: bigint = 0n;
    try {
        const { request } = await publicClient.simulateContract({
            account,
            address: positionManagerAddress,
            abi: UNIV3_POSITION_MANAGER_ABI,
            functionName: 'mint',
            args: [mintParams],
        });
        // @ts-ignore
        gasEstimate = request.gas || 700000n;
    } catch (simError: any) {
        return `Simulation failed! Cannot mint liquidity position. Check if ticks are valid for fee tier. Error: ${simError.message}`;
    }

    const tx = txManager.createPendingTransaction('univ3Mint', chainName, { 
      positionManagerAddress, token0, token1, amount0, amount1, tickLower, tickUpper,
      gasEstimate: gasEstimate.toString()
    });

    return `TRANSACTION_PENDING: Prepared Univ3 Liquidity deposit for ${amount0} ${meta0.symbol} & ${amount1} ${meta1.symbol}. Estimated gas: ${gasEstimate}. ID: ${tx.id}. Wait for user approval.`;
  } catch (error: any) {
    return `Failed to prepare liquidity provision: ${error.message}`;
  }
}

export const provideLiquidityToolDefinition = {
  type: "function",
  function: {
    name: "provide_liquidity_v3",
    description: "Provide liquidity to Uniswap V3 (or PancakeSwap V3 on BSC). The AI MUST NOT guess tickLower and tickUpper; it must ask the user for them if missing.",
    parameters: {
      type: "object",
      properties: {
        chainName: { type: "string", enum: SUPPORTED_CHAIN_NAMES },
        token0AddressOrSymbol: { type: "string" },
        token1AddressOrSymbol: { type: "string" },
        amount0Str: { type: "string" },
        amount1Str: { type: "string" },
        feeTier: { type: "number", description: "Uniswap fee tier (e.g. 500 for 0.05%, 3000 for 0.3%, 10000 for 1%)" },
        tickLower: { type: "number", description: "MUST BE PROVIDED BY USER." },
        tickUpper: { type: "number", description: "MUST BE PROVIDED BY USER." }
      },
      required: ["chainName", "token0AddressOrSymbol", "token1AddressOrSymbol", "amount0Str", "amount1Str", "feeTier"]
    }
  }
};
