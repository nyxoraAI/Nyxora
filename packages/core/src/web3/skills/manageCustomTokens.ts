import fs from 'fs';
import path from 'path';
import { getPath } from '../../config/paths';
import { SUPPORTED_CHAIN_NAMES, ChainName } from '../config';

export const manageCustomTokensDefinition = {
  type: 'function',
  function: {
    name: 'manage_custom_tokens',
    description: 'Add or remove a custom ERC-20 token (like a memecoin or specific token) from the user\'s local portfolio watcher.',
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
          description: 'The smart contract address of the token. Only required for "add" action.'
        }
      },
      required: ['action', 'chain_name', 'symbol']
    }
  }
};

export async function executeManageCustomTokens(args: any): Promise<string> {
  const { action, chain_name, symbol, contract_address } = args;

  if (!SUPPORTED_CHAIN_NAMES.includes(chain_name)) {
    return `Error: Unsupported chain ${chain_name}.`;
  }

  const customTokensPath = getPath('custom_tokens.json');
  let customTokens: Record<string, Record<string, string>> = {};

  if (fs.existsSync(customTokensPath)) {
    try {
      const data = fs.readFileSync(customTokensPath, 'utf8');
      customTokens = JSON.parse(data);
    } catch (e) {
      console.error('Error parsing custom_tokens.json', e);
    }
  }

  if (!customTokens[chain_name]) {
    customTokens[chain_name] = {};
  }

  const upperSymbol = symbol.toUpperCase();

  if (action === 'add') {
    if (!contract_address || !contract_address.startsWith('0x')) {
      return `Error: Invalid or missing contract_address.`;
    }
    customTokens[chain_name][upperSymbol] = contract_address;
    fs.writeFileSync(customTokensPath, JSON.stringify(customTokens, null, 2));
    return `Successfully added custom token ${upperSymbol} to the ${chain_name} portfolio tracker.`;
  } else if (action === 'remove') {
    if (customTokens[chain_name][upperSymbol]) {
      delete customTokens[chain_name][upperSymbol];
      fs.writeFileSync(customTokensPath, JSON.stringify(customTokens, null, 2));
      return `Successfully removed custom token ${upperSymbol} from the ${chain_name} portfolio tracker.`;
    } else {
      return `Warning: Token ${upperSymbol} was not found in the custom portfolio tracker for ${chain_name}.`;
    }
  }

  return `Error: Invalid action.`;
}
