import { SUPPORTED_CHAIN_NAMES, ChainName } from '../config';
import { saveTokenToWhitelist, removeTokenFromWhitelist } from '../../utils/userWhitelistManager';
import { getAddress } from '../utils/vaultClient';

export const manageCustomTokensDefinition = {
  type: 'function',
  function: {
    name: 'manage_custom_tokens',
    description: 'Add or remove a custom ERC-20 token (like a memecoin or specific token) from the user\'s local portfolio watcher and swap whitelist.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform: "add" or "remove".',
          enum: ['add', 'remove']
        },
        chain_name: {
          type: 'string',
          description: 'The blockchain network where this token exists.',
          enum: SUPPORTED_CHAIN_NAMES
        },
        symbol: {
          type: 'string',
          description: 'The token symbol (e.g., PEPE, SHIB, FLOKI).'
        },
        contract_address: {
          type: 'string',
          description: 'The smart contract address of the token. Required for "add" action or "remove" action.'
        }
      },
      required: ['action', 'chain_name', 'symbol', 'contract_address']
    }
  }
};

export async function executeManageCustomTokens(args: any): Promise<string> {
  const { action, chain_name, symbol, contract_address } = args;

  if (!chain_name) {
    throw new Error("Chain name is required.");
  }

  if (!symbol) {
    throw new Error("Token symbol is required.");
  }

  if (!SUPPORTED_CHAIN_NAMES.includes(chain_name as ChainName)) {
    return `Error: Unsupported chain ${chain_name}.`;
  }

  const upperSymbol = symbol.toUpperCase();
  const userAddress = await getAddress();

  if (action === 'add') {
    if (!contract_address || !contract_address.startsWith('0x')) {
      return `Error: Invalid or missing contract_address.`;
    }
    await saveTokenToWhitelist(userAddress, chain_name as ChainName, contract_address, 'manual', upperSymbol);
    return `Successfully added custom token ${upperSymbol} to the ${chain_name} portfolio tracker and swap whitelist.`;
  } else if (action === 'remove') {
    if (!contract_address || !contract_address.startsWith('0x')) {
      return `Error: Invalid or missing contract_address for removal.`;
    }
    removeTokenFromWhitelist(userAddress, chain_name, contract_address);
    return `Successfully removed custom token ${upperSymbol} from the ${chain_name} whitelist.`;
  }

  return `Error: Invalid action.`;
}
