"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintNftToolDefinition = void 0;
exports.prepareMintNft = prepareMintNft;
exports.executeMintNft = executeMintNft;
const viem_1 = require("viem");
const config_1 = require("../config");
const transactionManager_1 = require("../../agent/transactionManager");
async function prepareMintNft(chainName, contractAddress, functionSignature, argsStr, valueEth = "0") {
    try {
        const publicClient = (0, config_1.getPublicClient)(chainName);
        const userAddress = await (0, config_1.getAddress)();
        const account = userAddress;
        // Parse arguments from JSON or comma separated
        let parsedArgs = [];
        try {
            parsedArgs = JSON.parse(argsStr);
            if (!Array.isArray(parsedArgs)) {
                parsedArgs = [parsedArgs];
            }
        }
        catch (e) {
            if (argsStr.includes(",")) {
                parsedArgs = argsStr.split(",").map(i => i.trim());
            }
            else {
                parsedArgs = [argsStr.trim()];
            }
        }
        let cleanSig = functionSignature.trim();
        if (!cleanSig.startsWith("function ")) {
            cleanSig = `function ${cleanSig}`;
        }
        // ensure it's payable or nonpayable properly. Viem parseAbi requires it to be payable if we send value
        if (valueEth !== "0" && !cleanSig.includes("payable")) {
            cleanSig = `${cleanSig} payable`;
        }
        const abi = (0, viem_1.parseAbi)([cleanSig]);
        // Extract function name
        const match = cleanSig.match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
        if (!match)
            throw new Error("Invalid function signature format. Use e.g. 'mint(uint256)'");
        const functionName = match[1];
        const valueWei = (0, viem_1.parseEther)(valueEth);
        const { request } = await publicClient.simulateContract({
            account,
            address: contractAddress,
            abi,
            functionName,
            args: parsedArgs,
            value: valueWei,
        });
        // @ts-ignore
        const gasEstimate = request.gas || 100000n;
        const tx = transactionManager_1.txManager.createPendingTransaction('mint', chainName, {
            contractAddress,
            abi,
            functionName,
            parsedArgs,
            valueWei: valueWei.toString(),
            gasEstimate: gasEstimate.toString()
        });
        return `TRANSACTION_PENDING: Simulated NFT Minting successfully. Estimated gas units: ${gasEstimate}. Transaction ID: ${tx.id}. Wait for user to approve.`;
    }
    catch (error) {
        return `Simulation failed! Cannot prepare mint. Error: ${error.message}`;
    }
}
async function executeMintNft(chainName, params, autoApprove = false) {
    try {
        const { contractAddress, abi, functionName, parsedArgs, valueWei } = params;
        const token = process.env.INTERNAL_AUTH_TOKEN;
        const payload = {
            type: 'mint',
            chainName,
            autoApprove,
            details: {
                contractAddress, abi, functionName, parsedArgs, valueWei
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
        return `Mint executed. Result: ${JSON.stringify(data)}`;
    }
    catch (error) {
        return `Failed to execute mint: ${error.message}`;
    }
}
exports.mintNftToolDefinition = {
    type: "function",
    function: {
        name: "mint_nft",
        description: "Mint an NFT by calling a specific smart contract function. Automatically simulates the transaction first.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
                    description: "The blockchain network",
                },
                contractAddress: {
                    type: "string",
                    description: "The NFT smart contract address (0x...)",
                },
                functionSignature: {
                    type: "string",
                    description: "The function signature to call, e.g., 'mint(uint256)' or 'claim(address,uint256)'",
                },
                argsStr: {
                    type: "string",
                    description: "A JSON array of arguments for the function, e.g., '[1]' or '[\"0x123...\", 2]'",
                },
                valueEth: {
                    type: "string",
                    description: "The amount of native ETH/BNB to send as payment for the mint. Use '0' if it's a free mint.",
                }
            },
            required: ["chainName", "contractAddress", "functionSignature", "argsStr", "valueEth"],
        },
    },
};
