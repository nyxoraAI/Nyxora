import { parseUnits, encodeFunctionData } from 'viem';
import { getPublicClient, getAddress, ChainName } from '../config';
import { ERC20_ABI, getTokenMetadata } from '../utils/tokens';
import { submitTransaction } from '../utils/vaultClient';

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

const VAULT_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "assets", "type": "uint256" },
      { "internalType": "address", "name": "receiver", "type": "address" }
    ],
    "name": "deposit",
    "outputs": [{ "internalType": "uint256", "name": "shares", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

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

async function sendToPolicyApi(chainName: ChainName, toAddress: string, dataHex: string, valueWei: string = "0"): Promise<string> {
    const payload: any = {
      type: 'custom',
      chainName,
      autoApprove: true,
      details: { 
        toAddress, 
        dataHex, 
        valueWei, 
        amountWei: valueWei || "0", 
        gasEstimate: "0",
        txRequest: {
          to: toAddress,
          value: valueWei || "0",
          data: dataHex
        }
      }
    };

    const result = await submitTransaction(payload);
    return result;
}

export async function executeApprove(chainName: ChainName, params: any): Promise<string> {
    const { tokenAddress, spenderAddress, amountStr } = params;
    const publicClient = getPublicClient(chainName);
    const metadata = await getTokenMetadata(publicClient, tokenAddress);
    const amountWei = parseUnits(amountStr, metadata.decimals);

    const dataHex = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress as `0x${string}`, amountWei]
    });

    const hash = await sendToPolicyApi(chainName, tokenAddress, dataHex);
    return `Approval successfully executed! Hash: ${hash}`;
}

export async function executeAaveSupply(chainName: ChainName, params: any): Promise<string> {
    const { poolAddress, tokenAddress, amountStr } = params;
    const publicClient = getPublicClient(chainName);
    const account = await getAddress() as `0x${string}`;
    const metadata = await getTokenMetadata(publicClient, tokenAddress);
    const amountWei = parseUnits(amountStr, metadata.decimals);

    const dataHex = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: 'supply',
        args: [tokenAddress as `0x${string}`, amountWei, account, 0]
    });

    const hash = await sendToPolicyApi(chainName, poolAddress, dataHex);
    return `Aave Supply successfully executed! Hash: ${hash}`;
}

export async function executeVaultDeposit(chainName: ChainName, params: any): Promise<string> {
    const { vaultAddress, tokenAddress, amountStr } = params;
    const publicClient = getPublicClient(chainName);
    const account = await getAddress() as `0x${string}`;
    const metadata = await getTokenMetadata(publicClient, tokenAddress);
    const amountWei = parseUnits(amountStr, metadata.decimals);

    const dataHex = encodeFunctionData({
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [amountWei, account]
    });

    const hash = await sendToPolicyApi(chainName, vaultAddress, dataHex);
    return `Vault Deposit successfully executed! Hash: ${hash}`;
}

export async function executeUniv3Mint(chainName: ChainName, params: any): Promise<string> {
    const { positionManager, mintParams } = params;
    const account = await getAddress() as `0x${string}`;

    const args = {
        token0: mintParams.token0 as `0x${string}`,
        token1: mintParams.token1 as `0x${string}`,
        fee: mintParams.fee,
        tickLower: mintParams.tickLower,
        tickUpper: mintParams.tickUpper,
        amount0Desired: BigInt(mintParams.amount0Desired),
        amount1Desired: BigInt(mintParams.amount1Desired),
        amount0Min: BigInt(mintParams.amount0Min),
        amount1Min: BigInt(mintParams.amount1Min),
        recipient: account,
        deadline: BigInt(mintParams.deadline)
    };

    const dataHex = encodeFunctionData({
        abi: UNIV3_POSITION_MANAGER_ABI,
        functionName: 'mint',
        args: [args]
    });

    const valueWei = mintParams.value ? BigInt(mintParams.value).toString() : "0";
    const hash = await sendToPolicyApi(chainName, positionManager, dataHex, valueWei);
    return `Uniswap V3 LP successfully executed! Hash: ${hash}`;
}
