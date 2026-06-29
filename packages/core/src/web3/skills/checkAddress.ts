import { normalizeChainName } from '../utils/chains';
import { isAddress } from 'viem';
import { getPublicClient, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';

export async function checkAddress(chainName: ChainName, address: string): Promise<string> {
  try {
    chainName = normalizeChainName(chainName);
    if (!isAddress(address)) {
      return `Address validation failed: '${address}' is not a valid Web3 address format.`;
    }

    const client = getPublicClient(chainName);
    
    // Check if the address has bytecode (which means it's a Smart Contract)
    const bytecode = await client.getBytecode({ address: address as `0x${string}` });
    
    // Also get the balance just for additional info
    const balanceWei = await client.getBalance({ address: address as `0x${string}` });
    
    let result = `Address: ${address}\n`;
    result += `Status: Valid Format\n`;
    
    if (bytecode && bytecode !== '0x') {
      result += `Type: Smart Contract\n`;
    } else {
      result += `Type: EOA (Externally Owned Account / Standard Wallet)\n`;
    }
    
    return result;
  } catch (error: any) {
    return `Failed to check address: ${error.message}`;
  }
}

export const checkAddressToolDefinition = {
  type: "function",
  function: {
    name: "check_address",
    description: "Validate a Web3 address and determine if it is an EOA (standard wallet) or a Smart Contract.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The name of the blockchain to check the address on."
        },
        address: {
          type: "string",
          description: "The 0x... address to check."
        }
      },
      required: ["chainName", "address"]
    }
  }
};
