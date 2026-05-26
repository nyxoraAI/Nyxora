"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalanceToolDefinition = void 0;
exports.getBalance = getBalance;
const viem_1 = require("viem");
const config_1 = require("../config");
async function getBalance(chainName, address) {
    try {
        const client = (0, config_1.getPublicClient)(chainName);
        let targetAddress = address;
        if (!targetAddress) {
            // If address is not provided, try to get it from our own wallet
            const { getAddress } = await import('../config');
            targetAddress = getAddress();
        }
        const balanceWei = await client.getBalance({ address: targetAddress });
        const balanceEth = (0, viem_1.formatEther)(balanceWei);
        return `${balanceEth} on ${chainName}`;
    }
    catch (error) {
        return `Failed to get balance: ${error.message}`;
    }
}
exports.getBalanceToolDefinition = {
    type: "function",
    function: {
        name: "get_balance",
        description: "Get the native token balance (ETH, BNB, etc) of a wallet address on a specific chain. If address is omitted, it returns the balance of the agent's own wallet.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism"],
                    description: "The name of the blockchain to check."
                },
                address: {
                    type: "string",
                    description: "Optional. The 0x... address of the wallet. If not provided, it uses the agent's wallet."
                }
            },
            required: ["chainName"]
        }
    }
};
//# sourceMappingURL=getBalance.js.map