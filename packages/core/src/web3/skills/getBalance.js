"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalanceToolDefinition = void 0;
exports.getBalance = getBalance;
const viem_1 = require("viem");
const config_1 = require("../config");
const tokens_1 = require("../utils/tokens");
async function getBalance(chainName, address, token) {
    try {
        const client = (0, config_1.getPublicClient)(chainName);
        let targetAddress = address;
        if (!targetAddress) {
            const { getAddress } = await Promise.resolve().then(() => __importStar(require('../config')));
            targetAddress = (await getAddress());
        }
        if (!targetAddress) {
            throw new Error('Address is required but could not be resolved from private key.');
        }
        if (token) {
            const tokenAddress = (0, tokens_1.resolveToken)(token, chainName);
            if (tokenAddress === "0x0000000000000000000000000000000000000000") {
                const balanceWei = await client.getBalance({ address: targetAddress });
                const balanceEth = (0, viem_1.formatEther)(balanceWei);
                return `${balanceEth} on ${chainName}`;
            }
            else {
                const [balanceWei, decimals, symbol] = await Promise.all([
                    // @ts-ignore
                    client.readContract({
                        address: tokenAddress,
                        abi: tokens_1.ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [targetAddress],
                    }),
                    // @ts-ignore
                    client.readContract({
                        address: tokenAddress,
                        abi: tokens_1.ERC20_ABI,
                        functionName: 'decimals',
                    }),
                    // @ts-ignore
                    client.readContract({
                        address: tokenAddress,
                        abi: tokens_1.ERC20_ABI,
                        functionName: 'symbol',
                    }).catch(() => token)
                ]);
                const balanceFormatted = (0, viem_1.formatUnits)(balanceWei, decimals);
                return `${balanceFormatted} ${symbol} on ${chainName}`;
            }
        }
        else {
            const balanceWei = await client.getBalance({ address: targetAddress });
            const balanceEth = (0, viem_1.formatEther)(balanceWei);
            return `${balanceEth} on ${chainName}`;
        }
    }
    catch (error) {
        return `Failed to get balance: ${error.message}`;
    }
}
exports.getBalanceToolDefinition = {
    type: "function",
    function: {
        name: "get_balance",
        description: "Get the native or ERC-20 token balance of a wallet address on a specific chain. If address is omitted, it returns the balance of the agent's own wallet.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
                    description: "The name of the blockchain to check."
                },
                address: {
                    type: "string",
                    description: "Optional. The 0x... address of the wallet. If not provided, it uses the agent's wallet."
                },
                token: {
                    type: "string",
                    description: "Optional. The token symbol (e.g. USDC, USDT, WETH) or contract address (0x...) to check. If omitted, checks the native coin (ETH/BNB)."
                }
            },
            required: ["chainName"]
        }
    }
};
