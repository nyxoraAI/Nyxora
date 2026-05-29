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
exports.checkPortfolioToolDefinition = void 0;
exports.checkPortfolio = checkPortfolio;
const viem_1 = require("viem");
const config_1 = require("../config");
const tokens_1 = require("../utils/tokens");
async function checkPortfolio(chainName, address) {
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
        const tokensToScan = [
            { symbol: 'Native', address: '0x0000000000000000000000000000000000000000', isNative: true }
        ];
        const chainTokens = tokens_1.TOKEN_MAP[chainName];
        if (chainTokens) {
            for (const [sym, addr] of Object.entries(chainTokens)) {
                if (addr !== "0x0000000000000000000000000000000000000000") {
                    tokensToScan.push({ symbol: sym, address: addr, isNative: false });
                }
            }
        }
        let report = `📊 **Portfolio for ${targetAddress} on ${chainName.toUpperCase()}**\n\n`;
        let totalUsdValue = 0;
        // We will do Promise.all for balances
        const balancePromises = tokensToScan.map(async (t) => {
            let balanceNum = 0;
            if (t.isNative) {
                const bal = await client.getBalance({ address: targetAddress });
                balanceNum = parseFloat((0, viem_1.formatEther)(bal));
            }
            else {
                try {
                    const [balanceWei, decimals] = await Promise.all([
                        // @ts-ignore
                        client.readContract({
                            address: t.address,
                            abi: tokens_1.ERC20_ABI,
                            functionName: 'balanceOf',
                            args: [targetAddress],
                        }),
                        // @ts-ignore
                        client.readContract({
                            address: t.address,
                            abi: tokens_1.ERC20_ABI,
                            functionName: 'decimals',
                        })
                    ]);
                    balanceNum = parseFloat((0, viem_1.formatUnits)(balanceWei, decimals));
                }
                catch (e) {
                    balanceNum = 0;
                }
            }
            return { ...t, balanceNum };
        });
        const balances = await Promise.all(balancePromises);
        const nonZeroBalances = balances.filter(b => b.balanceNum > 0);
        if (nonZeroBalances.length === 0) {
            return report + `No funds found for standard tokens on this chain. Net Worth: $0.00`;
        }
        // Now fetch prices from Dexscreener
        // Prepare addresses to fetch
        const addressesToFetch = nonZeroBalances.map(b => b.isNative ? (chainTokens?.WETH || chainTokens?.WBNB) : b.address).filter(Boolean);
        const priceMap = {};
        if (addressesToFetch.length > 0) {
            const url = `https://api.dexscreener.com/latest/dex/tokens/${addressesToFetch.join(',')}`;
            try {
                const res = await fetch(url);
                const data = await res.json();
                if (data.pairs) {
                    data.pairs.forEach((p) => {
                        if (!priceMap[p.baseToken.address.toLowerCase()]) {
                            priceMap[p.baseToken.address.toLowerCase()] = parseFloat(p.priceUsd);
                        }
                    });
                }
            }
            catch (e) { }
        }
        for (const b of nonZeroBalances) {
            const lookupAddr = (b.isNative ? (chainTokens?.WETH || chainTokens?.WBNB) : b.address)?.toLowerCase() || "";
            const price = priceMap[lookupAddr] || 0;
            const usdValue = b.balanceNum * price;
            totalUsdValue += usdValue;
            report += `- **${b.symbol}**: ${b.balanceNum.toFixed(4)} (~$${usdValue.toFixed(2)})\n`;
        }
        report += `\n💰 **Estimated Net Worth: $${totalUsdValue.toFixed(2)}**`;
        return report;
    }
    catch (error) {
        return `Failed to check portfolio: ${error.message}`;
    }
}
exports.checkPortfolioToolDefinition = {
    type: "function",
    function: {
        name: "check_portfolio",
        description: "Scans the user's wallet for common tokens on a specific chain and calculates their total USD Net Worth (PNL proxy) using live prices.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
                    description: "The blockchain network",
                },
                address: {
                    type: "string",
                    description: "Optional wallet address. If omitted, uses the AI agent's own wallet.",
                }
            },
            required: ["chainName"],
        },
    },
};
