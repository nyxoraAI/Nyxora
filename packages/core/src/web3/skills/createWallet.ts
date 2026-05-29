import { generateMnemonic, english, mnemonicToAccount } from 'viem/accounts';

export async function createWallet(): Promise<string> {
  try {
    const mnemonic = generateMnemonic(english);
    const account = mnemonicToAccount(mnemonic);
    
    return `[WALLET_CREATED_SUCCESSFULLY]
A new EVM wallet has been generated. Please instruct the user to back up these details immediately as they will not be saved anywhere else:

Address: ${account.address}
Private Key: ${account.getHdKey().privateKey ? '0x' + Buffer.from(account.getHdKey().privateKey!).toString('hex') : 'Unavailable'}
Seed Phrase: ${mnemonic}

IMPORTANT: Do not store this data in your AI memory. Only display it once.`;
  } catch (error: any) {
    return `Failed to generate wallet: ${error.message}`;
  }
}

export const createWalletToolDefinition = {
  type: "function",
  function: {
    name: "create_wallet",
    description: "Generates a new EVM wallet address, private key, and 12-word seed phrase.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};
