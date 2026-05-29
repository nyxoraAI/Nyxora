"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAddressToolDefinition = void 0;
exports.checkAddress = checkAddress;
const viem_1 = require("viem");
const config_1 = require("../config");
async function checkAddress(chainName, address) {
    try {
        if (!(0, viem_1.isAddress)(address)) {
            return `Address validation failed: '${address}' is not a valid Web3 address format.`;
        }
        const client = (0, config_1.getPublicClient)(chainName);
        // Check if the address has bytecode (which means it's a Smart Contract)
        const bytecode = await client.getBytecode({ address: address });
        // Also get the balance just for additional info
        const balanceWei = await client.getBalance({ address: address });
        let result = `Address: ${address}\n`;
        result += `Status: Valid Format\n`;
        if (bytecode && bytecode !== '0x') {
            result += `Type: Smart Contract\n`;
        }
        else {
            result += `Type: EOA (Externally Owned Account / Standard Wallet)\n`;
        }
        return result;
    }
    catch (error) {
        return `Failed to check address: ${error.message}`;
    }
}
exports.checkAddressToolDefinition = {
    type: "function",
    function: {
        name: "check_address",
        description: "Validate a Web3 address and determine if it is an EOA (standard wallet) or a Smart Contract.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
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
