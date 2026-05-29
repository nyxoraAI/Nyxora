"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferToolDefinition = void 0;
exports.prepareTransfer = prepareTransfer;
exports.executeTransfer = executeTransfer;
const viem_1 = require("viem");
const config_1 = require("../config");
const transactionManager_1 = require("../../agent/transactionManager");
const tokens_1 = require("../utils/tokens");
async function prepareTransfer(chainName, toAddress, amountStr, token) {
    try {
        const publicClient = (0, config_1.getPublicClient)(chainName);
        const userAddress = await (0, config_1.getAddress)();
        const account = userAddress;
        let tokenAddress = "0x0000000000000000000000000000000000000000";
        let isNative = true;
        let decimals = 18;
        let symbol = "ETH/BNB"; // Generic fallback for native
        if (token) {
            tokenAddress = (0, tokens_1.resolveToken)(token, chainName);
            isNative = tokenAddress === "0x0000000000000000000000000000000000000000";
        }
        let gasEstimate = 0n;
        if (isNative) {
            // Simulate Native Transfer
            const value = (0, viem_1.parseEther)(amountStr);
            gasEstimate = await publicClient.estimateGas({
                account,
                to: toAddress,
                value,
            });
        }
        else {
            // Simulate ERC-20 Transfer
            // @ts-ignore
            decimals = await publicClient.readContract({
                address: tokenAddress,
                abi: tokens_1.ERC20_ABI,
                functionName: 'decimals',
            });
            // @ts-ignore
            symbol = await publicClient.readContract({
                address: tokenAddress,
                abi: tokens_1.ERC20_ABI,
                functionName: 'symbol',
            }).catch(() => token || "TOKEN");
            const value = (0, viem_1.parseUnits)(amountStr, decimals);
            const { request } = await publicClient.simulateContract({
                account,
                address: tokenAddress,
                abi: tokens_1.ERC20_ABI,
                functionName: 'transfer',
                args: [toAddress, value],
            });
            // @ts-ignore
            gasEstimate = request.gas || 50000n;
        }
        const tx = transactionManager_1.txManager.createPendingTransaction('transfer', chainName, {
            toAddress,
            amountStr,
            tokenAddress,
            isNative,
            decimals,
            gasEstimate: gasEstimate.toString()
        });
        const tokenName = isNative ? "Native Token" : symbol;
        return `TRANSACTION_PENDING: I have prepared the ${tokenName} transfer and simulated it successfully. Estimated gas units: ${gasEstimate}. Transaction ID: ${tx.id}. Wait for user to approve.`;
    }
    catch (error) {
        return `Simulation failed! Cannot prepare transfer. Error: ${error.message}`;
    }
}
async function executeTransfer(chainName, params, autoApprove = false) {
    try {
        const { toAddress, amountStr, tokenAddress, isNative, decimals } = params;
        const token = process.env.INTERNAL_AUTH_TOKEN;
        const payload = {
            type: 'transfer',
            chainName,
            autoApprove,
            details: {
                toAddress, amountStr, tokenAddress, isNative, decimals
            }
        };
        const res = await fetch('http://127.0.0.1:3001/request-tx', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Unknown error from Policy API');
        if (data.status === 'pending') {
            return `Transaction pending approval via Policy API. Tx ID: ${data.txId}`;
        }
        return `Transaction executed. Result: ${JSON.stringify(data)}`;
    }
    catch (error) {
        return `Failed to execute transfer: ${error.message}`;
    }
}
exports.transferToolDefinition = {
    type: "function",
    function: {
        name: "transfer_token",
        description: "Transfer native tokens (ETH, BNB, etc.) or ERC-20 tokens from the agent's wallet to a destination address. Automatically performs on-chain simulation before requesting user approval.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
                    description: "The name of the blockchain to execute the transfer on."
                },
                toAddress: {
                    type: "string",
                    description: "The destination 0x... wallet address."
                },
                amountStr: {
                    type: "string",
                    description: "The amount of tokens to send (e.g. '0.01')."
                },
                token: {
                    type: "string",
                    description: "Optional. The token symbol (e.g. USDC, USDT) or contract address (0x...). If omitted, sends the native coin."
                }
            },
            required: ["chainName", "toAddress", "amountStr"]
        }
    }
};
