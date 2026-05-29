"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletToolDefinition = void 0;
exports.createWallet = createWallet;
const accounts_1 = require("viem/accounts");
async function createWallet() {
    try {
        const mnemonic = (0, accounts_1.generateMnemonic)(accounts_1.english);
        const account = (0, accounts_1.mnemonicToAccount)(mnemonic);
        return `[WALLET_CREATED_SUCCESSFULLY]
A new EVM wallet has been generated. Please instruct the user to back up these details immediately as they will not be saved anywhere else:

Address: ${account.address}
Private Key: ${account.getHdKey().privateKey ? '0x' + Buffer.from(account.getHdKey().privateKey).toString('hex') : 'Unavailable'}
Seed Phrase: ${mnemonic}

IMPORTANT: Do not store this data in your AI memory. Only display it once.`;
    }
    catch (error) {
        return `Failed to generate wallet: ${error.message}`;
    }
}
exports.createWalletToolDefinition = {
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
