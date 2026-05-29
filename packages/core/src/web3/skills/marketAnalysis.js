"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketAnalysisToolDefinition = void 0;
exports.analyzeMarket = analyzeMarket;
const tokens_1 = require("../utils/tokens");
async function analyzeMarket(chainName, tokenAddressOrSymbol) {
    try {
        let tokenAddress = tokenAddressOrSymbol;
        try {
            tokenAddress = (0, tokens_1.resolveToken)(tokenAddressOrSymbol, chainName);
            if (tokenAddress === "0x0000000000000000000000000000000000000000") {
                // For native token, we should pass WETH / wrapped version to Dexscreener usually, 
                // because native token itself doesn't have a pair on most DEXes directly.
                tokenAddress = (0, tokens_1.resolveToken)("W" + tokenAddressOrSymbol, chainName); // e.g. WETH, WBNB
            }
        }
        catch (e) {
            // If it fails to resolve, assume it's already an address or let DexScreener handle it (though DexScreener needs exact address)
        }
        const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`DexScreener API Error: ${res.statusText}`);
        }
        const data = await res.json();
        if (!data.pairs || data.pairs.length === 0) {
            return `No market data found for token ${tokenAddressOrSymbol} on DexScreener.`;
        }
        // Filter pairs by chain if possible, Dexscreener chain IDs are strings like 'ethereum', 'bsc', 'base', 'arbitrum', 'optimism'
        let pair = data.pairs.find((p) => p.chainId === chainName);
        if (!pair) {
            pair = data.pairs[0]; // Fallback to the most liquid pair anywhere
        }
        let report = `📈 **Market Analysis for ${pair.baseToken.name} (${pair.baseToken.symbol})** on ${pair.chainId.toUpperCase()}\n\n`;
        report += `**Price:** $${pair.priceUsd}\n`;
        report += `**Liquidity (USD):** $${Number(pair.liquidity?.usd || 0).toLocaleString()}\n`;
        report += `**FDV:** $${Number(pair.fdv || 0).toLocaleString()}\n`;
        report += `**24h Volume:** $${Number(pair.volume?.h24 || 0).toLocaleString()}\n\n`;
        report += `**Price Change:**\n`;
        report += `- 5m:  ${pair.priceChange?.m5}% \n`;
        report += `- 1h:  ${pair.priceChange?.h1}% \n`;
        report += `- 24h: ${pair.priceChange?.h24}% \n\n`;
        report += `**DEX:** ${pair.dexId} (${pair.url})\n`;
        return report;
    }
    catch (error) {
        return `Failed to analyze market: ${error.message}`;
    }
}
exports.marketAnalysisToolDefinition = {
    type: "function",
    function: {
        name: "analyze_market",
        description: "Fetches live market data (Price, Liquidity, Volume, FDV, Price Change) for a token using DexScreener.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
                    description: "The blockchain network",
                },
                tokenAddressOrSymbol: {
                    type: "string",
                    description: "The token symbol (e.g. USDC, PEPE) or contract address to analyze.",
                }
            },
            required: ["chainName", "tokenAddressOrSymbol"],
        },
    },
};
