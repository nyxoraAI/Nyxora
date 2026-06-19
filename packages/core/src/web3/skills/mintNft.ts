import { parseAbi, parseEther } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';

export async function prepareMintNft(
  chainName: ChainName, 
  contractAddress: `0x${string}`, 
  functionSignature: string,
  argsStr: string,
  valueEth: string = "0"
): Promise<string> {
  try {
    if (!chainName || !contractAddress || !functionSignature) throw new Error("Missing required parameters to mint NFT.");
    const publicClient = getPublicClient(chainName);
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
    // Parse arguments from JSON or comma separated
    let parsedArgs: any[] = [];
    try {
      parsedArgs = JSON.parse(argsStr);
      if (!Array.isArray(parsedArgs)) {
        parsedArgs = [parsedArgs];
      }
    } catch (e) {
      if (argsStr.includes(",")) {
        parsedArgs = argsStr.split(",").map(i => i.trim());
      } else {
        parsedArgs = [argsStr.trim()];
      }
    }

    let cleanSig = functionSignature.trim();
    if (!cleanSig.startsWith("function ")) {
      cleanSig = `function ${cleanSig}`;
    }
    // ensure it's payable or nonpayable properly. Viem parseAbi requires it to be payable if we send value
    if (valueEth !== "0" && !cleanSig.includes("payable")) {
      cleanSig = `${cleanSig} payable`;
    }

    const abi = parseAbi([cleanSig]);
    
    // Extract function name
    const match = cleanSig.match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
    if (!match) throw new Error("Invalid function signature format. Use e.g. 'mint(uint256)'");
    const functionName = match[1];

    const valueWei = parseEther(valueEth);

    const { request } = await publicClient.simulateContract({
      account,
      address: contractAddress,
      abi,
      functionName,
      args: parsedArgs,
      value: valueWei,
    });
    
    // @ts-ignore
    const gasEstimate = request.gas || 100000n;

    const tx = txManager.createPendingTransaction('mint', chainName, { 
      contractAddress,
      abi,
      functionName,
      parsedArgs,
      valueWei: valueWei.toString(),
      gasEstimate: gasEstimate.toString()
    });

    return `⏳ **Mint NFT queued:** ${contractAddress} | ${chainName.toUpperCase()} | ⚠️ Verify Contract | Approve below.`;
  } catch (error: any) {
    return `Simulation failed! Cannot prepare mint. Error: ${error.message}`;
  }
}

import { submitTransaction } from '../utils/vaultClient';

export async function executeMintNft(chainName: ChainName, params: any, autoApprove: boolean = false): Promise<string> {
  try {
    const { contractAddress, dataHex, amountStr, valueWei } = params;

    const payload: any = {
      type: 'mint',
      chainName,
      autoApprove,
      details: { 
        contractAddress, 
        dataHex, 
        amountStr, 
        valueWei, 
        amountWei: valueWei,
        txRequest: {
          to: contractAddress,
          value: valueWei,
          data: dataHex
        }
      }
    };

    const result = await submitTransaction(payload);
    return result;
  } catch (error: any) {
    return `Failed to execute mint: ${error.message}`;
  }
}

export const mintNftToolDefinition = {
  type: "function",
  function: {
    name: "mint_nft",
    description: "Mint an NFT by calling a specific smart contract function. Automatically simulates the transaction first.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The blockchain network",
        },
        contractAddress: {
          type: "string",
          description: "The NFT smart contract address (0x...)",
        },
        functionSignature: {
          type: "string",
          description: "The function signature to call, e.g., 'mint(uint256)' or 'claim(address,uint256)'",
        },
        argsStr: {
          type: "string",
          description: "A JSON array of arguments for the function, e.g., '[1]' or '[\"0x123...\", 2]'",
        },
        valueEth: {
          type: "string",
          description: "The amount of native ETH/BNB to send as payment for the mint. Use '0' if it's a free mint.",
        }
      },
      required: ["chainName", "contractAddress", "functionSignature", "argsStr", "valueEth"],
    },
  },
};
