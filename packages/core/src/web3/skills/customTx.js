"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customTxToolDefinition = void 0;
exports.prepareCustomTx = prepareCustomTx;
exports.executeCustomTx = executeCustomTx;
const viem_1 = require("viem");
const config_1 = require("../config");
const transactionManager_1 = require("../../agent/transactionManager");
async function prepareCustomTx(chainName, toAddress, dataHex, valueEth = "0", gasLimitStr) {
    try {
        const publicClient = (0, config_1.getPublicClient)(chainName);
        const userAddress = await (0, config_1.getAddress)();
        const account = userAddress;
        if (!dataHex.startsWith("0x")) {
            throw new Error("Data must start with 0x (Hex format)");
        }
        const valueWei = (0, viem_1.parseEther)(valueEth);
        let gasEstimate = 0n;
        if (gasLimitStr) {
            gasEstimate = BigInt(gasLimitStr);
        }
        else {
            gasEstimate = await publicClient.estimateGas({
                account,
                to: toAddress,
                data: dataHex,
                value: valueWei,
            });
        }
        const tx = transactionManager_1.txManager.createPendingTransaction('custom', chainName, {
            toAddress,
            dataHex,
            valueWei: valueWei.toString(),
            gasEstimate: gasEstimate.toString()
        });
        return `TRANSACTION_PENDING: Simulated Custom Transaction successfully. Estimated gas units: ${gasEstimate}. Transaction ID: ${tx.id}. Wait for user to approve.`;
    }
    catch (error) {
        return `Simulation failed! Cannot prepare custom tx. Error: ${error.message}`;
    }
}
async function executeCustomTx(chainName, params, autoApprove = false) {
    try {
        const { toAddress, dataHex, valueWei, gasEstimate } = params;
        const token = process.env.INTERNAL_AUTH_TOKEN;
        const payload = {
            type: 'custom',
            chainName,
            autoApprove,
            details: {
                toAddress, dataHex, valueWei, gasEstimate
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
        return `Custom transaction executed. Result: ${JSON.stringify(data)}`;
    }
    catch (error) {
        return `Failed to execute custom transaction: ${error.message}`;
    }
}
exports.customTxToolDefinition = {
    type: "function",
    function: {
        name: "custom_tx",
        description: "Executes a raw custom transaction with calldata (hex) on a specific blockchain network. Automatically simulates the execution.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
                    description: "The blockchain network",
                },
                toAddress: {
                    type: "string",
                    description: "The destination contract or wallet address (0x...)",
                },
                dataHex: {
                    type: "string",
                    description: "The raw calldata payload in hex format (starting with 0x)",
                },
                valueEth: {
                    type: "string",
                    description: "The amount of native ETH/BNB to attach. Default is '0'.",
                },
                gasLimitStr: {
                    type: "string",
                    description: "Optional custom gas limit as a string. If omitted, the node will estimate it.",
                }
            },
            required: ["chainName", "toAddress", "dataHex", "valueEth"],
        },
    },
};
