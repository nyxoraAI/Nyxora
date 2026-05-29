"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bridgeTokenToolDefinition = void 0;
exports.prepareBridgeToken = prepareBridgeToken;
exports.executeBridge = executeBridge;
const viem_1 = require("viem");
const config_1 = require("../config");
const transactionManager_1 = require("../../agent/transactionManager");
const tokens_1 = require("../utils/tokens");
const CHAIN_IDS = {
    ethereum: 1,
    base: 8453,
    bsc: 56,
    arbitrum: 42161,
    optimism: 10,
    sepolia: 11155111,
};
async function getLifiQuote(fromChainId, toChainId, fromToken, toToken, amountWei, userAddress, slippage) {
    const url = new URL('https://li.quest/v1/quote');
    url.searchParams.append('fromChain', fromChainId.toString());
    url.searchParams.append('toChain', toChainId.toString());
    url.searchParams.append('fromToken', fromToken);
    url.searchParams.append('toToken', toToken);
    url.searchParams.append('fromAmount', amountWei);
    url.searchParams.append('fromAddress', userAddress);
    url.searchParams.append('slippage', slippage.toString());
    const res = await fetch(url.toString());
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Li.Fi API Error: ${err.message || res.statusText}`);
    }
    return await res.json();
}
async function getRelayQuote(fromChainId, toChainId, fromToken, toToken, amountWei, userAddress) {
    const isTestnet = fromChainId === 11155111 || toChainId === 11155111;
    const baseUrl = isTestnet ? "https://api.testnets.relay.link" : "https://api.relay.link";
    const body = {
        user: userAddress,
        originChainId: fromChainId,
        destinationChainId: toChainId,
        originCurrency: fromToken,
        destinationCurrency: toToken,
        amount: amountWei,
        tradeType: "EXACT_INPUT"
    };
    const res = await fetch(`${baseUrl}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Relay API Error: ${err.message || res.statusText}`);
    }
    return await res.json();
}
async function prepareBridgeToken(fromChainName, toChainName, fromToken, toToken, amountStr, mode = "auto", providerName = "lifi", slippagePercent = 0.5) {
    try {
        const publicClient = (0, config_1.getPublicClient)(fromChainName);
        const userAddress = await (0, config_1.getAddress)();
        const account = userAddress;
        const fromChainId = CHAIN_IDS[fromChainName];
        const toChainId = CHAIN_IDS[toChainName];
        const fromTokenAddress = (0, tokens_1.resolveToken)(fromToken, fromChainName);
        const toTokenAddress = (0, tokens_1.resolveToken)(toToken, toChainName);
        const isNativeIn = fromTokenAddress === "0x0000000000000000000000000000000000000000";
        // Get decimals
        let decimals = 18;
        if (!isNativeIn) {
            // @ts-ignore
            decimals = await publicClient.readContract({
                address: fromTokenAddress,
                abi: tokens_1.ERC20_ABI,
                functionName: 'decimals',
            });
        }
        const amountWei = (0, viem_1.parseUnits)(amountStr, decimals).toString();
        let txRequest = null;
        let approvalAddress = null;
        let expectedOutputStr = "";
        let actualProvider = mode === "auto" ? "lifi" : providerName;
        const isTestnet = fromChainId === 11155111 || toChainId === 11155111;
        // --- SEPOLIA TESTNET MOCK ---
        if (isTestnet) {
            const mockGasLimit = "150000";
            expectedOutputStr = "MOCK_TEST_AMOUNT";
            const tx = transactionManager_1.txManager.createPendingTransaction('bridge', fromChainName, {
                txRequest: { to: fromTokenAddress, data: "0x", value: amountWei, gasLimit: mockGasLimit },
                needsApprove: false,
                fromTokenAddress,
                approvalAddress: null,
                amountWei
            });
            return `TRANSACTION_PENDING: Bridge simulated via TESTNET_MOCK. Expected Output on ${toChainName}: ~${expectedOutputStr} ${toToken.toUpperCase()}. Gas est: ${mockGasLimit}. Transaction ID: ${tx.id}. Wait for user to approve.`;
        }
        // --- END MOCK ---
        if (actualProvider === "lifi") {
            const quote = await getLifiQuote(fromChainId, toChainId, fromTokenAddress, toTokenAddress, amountWei, userAddress, slippagePercent / 100);
            txRequest = quote.transactionRequest;
            approvalAddress = quote.estimate.approvalAddress;
            const toDecimals = quote.action.toToken.decimals;
            expectedOutputStr = (0, viem_1.formatUnits)(BigInt(quote.estimate.toAmount), toDecimals);
        }
        else if (actualProvider === "relay") {
            const relayQuote = await getRelayQuote(fromChainId, toChainId, fromTokenAddress, toTokenAddress, amountWei, userAddress);
            if (!relayQuote.steps || relayQuote.steps.length === 0)
                throw new Error("No route found by Relay.");
            const txStep = relayQuote.steps.find((s) => s.id === "execute");
            if (!txStep || !txStep.items || txStep.items.length === 0)
                throw new Error("Relay steps invalid.");
            const item = txStep.items[0];
            txRequest = item.data;
            if (!isNativeIn && txRequest.to.toLowerCase() !== fromTokenAddress.toLowerCase()) {
                approvalAddress = txRequest.to;
            }
            expectedOutputStr = relayQuote.details?.currencyOut?.amountFormatted || "Unknown";
        }
        let needsApprove = false;
        if (!isNativeIn && approvalAddress && approvalAddress !== "0x0000000000000000000000000000000000000000") {
            // @ts-ignore
            const allowance = await publicClient.readContract({
                address: fromTokenAddress,
                abi: tokens_1.ERC20_ABI,
                functionName: 'allowance',
                args: [userAddress, approvalAddress],
            });
            if (allowance < BigInt(amountWei)) {
                needsApprove = true;
            }
        }
        const tx = transactionManager_1.txManager.createPendingTransaction('bridge', fromChainName, {
            txRequest,
            needsApprove,
            fromTokenAddress,
            approvalAddress,
            amountWei
        });
        return `TRANSACTION_PENDING: Bridge simulated via ${actualProvider.toUpperCase()}. Expected Output on ${toChainName}: ~${expectedOutputStr} ${toToken.toUpperCase()}. ${needsApprove ? '(Auto-Approve required) ' : ''}Gas est: ${txRequest.gasLimit || 'auto'}. Transaction ID: ${tx.id}. Wait for user to approve.`;
    }
    catch (error) {
        return `Simulation failed! Cannot prepare bridge. Error: ${error.message}`;
    }
}
async function executeBridge(chainName, params, autoApprove = false) {
    try {
        const { txRequest, needsApprove, fromTokenAddress, approvalAddress, amountWei } = params;
        const token = process.env.INTERNAL_AUTH_TOKEN;
        const payload = {
            type: 'bridge',
            chainName,
            autoApprove,
            details: {
                txRequest, needsApprove, fromTokenAddress, approvalAddress, amountWei
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
        return `Bridge executed. Result: ${JSON.stringify(data)}`;
    }
    catch (error) {
        return `Failed to execute bridge: ${error.message}`;
    }
}
exports.bridgeTokenToolDefinition = {
    type: "function",
    function: {
        name: "bridge_token",
        description: "Executes a cross-chain token bridge from one network to another using Li.Fi or Relay. Automatically simulates to fetch quotes.",
        parameters: {
            type: "object",
            properties: {
                fromChainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
                    description: "The source blockchain network",
                },
                toChainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
                    description: "The destination blockchain network",
                },
                fromToken: {
                    type: "string",
                    description: "The token symbol to sell on source chain (e.g., 'ETH', 'USDC')",
                },
                toToken: {
                    type: "string",
                    description: "The token symbol to buy on destination chain (e.g., 'USDC', 'UNI')",
                },
                amountStr: {
                    type: "string",
                    description: "The amount of fromToken to bridge",
                },
                mode: {
                    type: "string",
                    enum: ["auto", "manual"],
                    description: "auto uses lifi. manual uses the specified provider."
                },
                providerName: {
                    type: "string",
                    enum: ["lifi", "relay"],
                    description: "Used if mode is manual."
                }
            },
            required: ["fromChainName", "toChainName", "fromToken", "toToken", "amountStr"],
        },
    },
};
