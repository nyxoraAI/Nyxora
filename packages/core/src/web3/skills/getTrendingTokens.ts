import { safeFetchJson } from '../../utils/httpClient';
import { SUPPORTED_CHAIN_NAMES, ChainName } from '../config';

/**
 * Interface representing the structure of DexScreener Boost API response
 */
export interface DexBoostToken {
    url: string;
    chainId: string;
    tokenAddress: string;
    description?: string;
    icon?: string;
    header?: string;
    totalAmount: number;
}

/**
 * Fetches the most trending/viral tokens on DexScreener using the Token Boosts API.
 * @param chainName Optional chain filter (e.g. 'solana', 'bsc', 'ethereum')
 * @param limit Maximum number of tokens to return
 * @returns Formatted markdown string containing the viral tokens
 */
export async function getTrendingTokens(chainName?: ChainName | string, limit: number = 5): Promise<string> {
    try {
        if (chainName) {
            const targetChain = chainName.toLowerCase();
            try {
                const geckoUrl = `https://api.geckoterminal.com/api/v2/networks/${targetChain}/trending_pools`;
                const geckoRes = await safeFetchJson<any>(geckoUrl);
                
                if (geckoRes && geckoRes.data && geckoRes.data.length > 0) {
                    const topTokens = geckoRes.data.slice(0, limit);
                    let report = `🔥 **GeckoTerminal Trending Pools** on ${chainName.toUpperCase()}\n\n`;
                    
                    topTokens.forEach((pool: any, index: number) => {
                        const attrs = pool.attributes;
                        const baseTokenId = pool.relationships?.base_token?.data?.id || '';
                        const ca = baseTokenId.replace(`${targetChain}_`, '') || attrs.address;
                        
                        report += `### ${index + 1}. Token CA: \`${ca}\`\n`;
                        report += `- **Pair Name**: ${attrs.name || 'Unknown'}\n`;
                        report += `- **Price (USD)**: $${attrs.base_token_price_usd || '0'}\n`;
                        report += `- **FDV**: $${parseFloat(attrs.fdv_usd || '0').toLocaleString(undefined, {maximumFractionDigits: 0})}\n`;
                        report += `- **24h Vol**: $${parseFloat(attrs.volume_usd?.h24 || '0').toLocaleString(undefined, {maximumFractionDigits: 0})}\n`;
                        report += `- **24h Change**: ${attrs.price_change_percentage?.h24 || '0'}%\n\n`;
                    });
                    
                    report += `\n*System Note for LLM: Use these Contract Addresses (CA) to automatically call the 'analyze_market' tool if the user requested a deep dive analysis.*`;
                    return report;
                }
            } catch (e) {
                console.warn(`[GeckoTerminal] Failed to fetch for ${targetChain}, falling back to DexScreener`, e);
            }
        }

        // DexScreener's public endpoint for highest boosted (trending) tokens
        const url = 'https://api.dexscreener.com/token-boosts/top/v1';
        
        const boostedTokens = await safeFetchJson<DexBoostToken[]>(url);
        
        if (!boostedTokens || !Array.isArray(boostedTokens) || boostedTokens.length === 0) {
            return `[Market Intelligence] Failed to fetch trending tokens from DexScreener. The API might be temporarily unavailable.`;
        }

        let filteredTokens = boostedTokens;

        // Apply chain filter if provided by the LLM (as a fallback if GeckoTerminal failed/empty)
        if (chainName) {
            const targetChain = chainName.toLowerCase();
            filteredTokens = boostedTokens.filter(t => t.chainId.toLowerCase() === targetChain);
            
            if (filteredTokens.length === 0) {
                return `[Market Intelligence] No viral/trending tokens found specifically for the '${chainName}' network at this moment on DexScreener or GeckoTerminal.`;
            }
        }

        // Slice to the requested limit to prevent context window bloat
        const topTokens = filteredTokens.slice(0, limit);

        let report = `🔥 **DexScreener Viral / Trending Tokens** ${chainName ? `on ${chainName.toUpperCase()}` : '(Cross-Chain)'}\n\n`;
        
        topTokens.forEach((token, index) => {
            report += `### ${index + 1}. Token CA: \`${token.tokenAddress}\`\n`;
            report += `- **Network**: ${token.chainId.toUpperCase()}\n`;
            report += `- **DexScreener Link**: ${token.url}\n`;
            report += `- **Boosts**: ${token.totalAmount} 🔥\n`;
            
            // Clean up description if it's too long
            if (token.description) {
                const desc = token.description.replace(/\n/g, ' ').trim();
                const snippet = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;
                report += `- **Description**: "${snippet}"\n`;
            }
            report += `\n`;
        });

        report += `\n*System Note for LLM: Use these Contract Addresses (CA) to automatically call the 'analyze_market' tool if the user requested a deep dive analysis.*`;

        return report;
    } catch (error: any) {
        return `[Market Intelligence] An error occurred while fetching trending tokens: ${error.message}`;
    }
}

export const getTrendingTokensToolDefinition = {
    type: "function",
    function: {
        name: "get_trending_tokens",
        description: "Fetches the most viral/trending tokens currently boosted on DexScreener. Use this when the user asks for new, viral, or trending tokens without providing a specific contract address.",
        parameters: {
            type: "object",
            properties: {
                chainName: {
                    type: "string",
                    description: "Optional network filter (e.g. 'bsc', 'solana', 'ethereum', 'base'). If the user mentions a specific chain, put it here.",
                }
            },
        },
    },
};
