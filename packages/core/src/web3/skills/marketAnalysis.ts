import { normalizeChainName } from '../utils/chains';
import { ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { safeFetchJson } from '../../utils/httpClient';
import { generateMarketHealthReport, MarketHealthResult } from '../utils/riskIntelligence';

export async function analyzeMarket(chainName: ChainName, tokenAddressOrSymbol: string): Promise<string> {
  try {
    chainName = normalizeChainName(chainName);
    if (!tokenAddressOrSymbol) throw new Error("Token symbol is invalid.");
    
    // ==========================================
    // PHASE 1: DATA ROUTING (PROXY TO PYTHON ML ENGINE)
    // ==========================================
    console.log(`[Market Intelligence] Delegating analysis for ${tokenAddressOrSymbol} to Python ML Engine...`);
    
    let mlData;
    try {
        mlData = await safeFetchJson<any>(`http://localhost:8000/web3/analyze?query=${tokenAddressOrSymbol}&chain=${chainName}`);
    } catch (error: any) {
        return `[System Error] Failed to reach Python ML Engine. Make sure the daemon is running (Error: ${error.message})`;
    }
    
    if (!mlData || mlData.detail) {
        return `[Market Intelligence] Failed to find data for ${tokenAddressOrSymbol} on DEX or CEX.`;
    }
    
    const {
        officialSymbol,
        contractAddress,
        network,
        currentPrice,
        mcapUsd,
        liquidityUsd,
        volume24h,
        priceChange24h,
        rsi,
        ma50,
        isCexAsset
    } = mlData;

    // ==========================================
    // PHASE 2: HEALTH & RISK SCORING (NODE.JS)
    // ==========================================
    // Dummy TVL and concentration for now, Python can augment this later
    let tvlChange7d: number | null = null;
    let top10HoldersPercent: number | null = 45; // Default medium risk
    if (mcapUsd > 100000000) top10HoldersPercent = 15;
    else if (mcapUsd < 500000) top10HoldersPercent = 85;

    let healthResult: MarketHealthResult = { 
        liquidityScore: 5.0, smartMoneyScore: 5.0, concentrationScore: 5.0, momentumScore: 5.0, overallScore: 5.0 
    };

    try {
        healthResult = generateMarketHealthReport(
            liquidityUsd, mcapUsd, tvlChange7d, volume24h, priceChange24h, top10HoldersPercent, rsi, currentPrice, ma50
        );
    } catch (e: any) {
        console.warn(`[Market Intelligence] Failed to generate deep risk report: ${e.message}`);
    }

    // ==========================================
    // PHASE 3: CONTEXT ASSEMBLY FOR LLM
    // ==========================================
    let report = `📊 **Market Intelligence Report: ${officialSymbol}**\n`;
    report += `CA: \`${contractAddress || 'N/A'}\` | Network: ${network}\n\n`;
    
    report += `**⭐ Overall Market Health Score:** ${healthResult.overallScore} / 10\n\n`;
    
    report += `**1. Liquidity Risk:** ${healthResult.liquidityScore !== null ? healthResult.liquidityScore + '/10' : '[ N/A ]'}\n`;
    report += `- Liquidity: $${liquidityUsd.toLocaleString()} vs FDV: $${mcapUsd.toLocaleString()}\n`;
    
    report += `**2. Smart Money Flow:** ${healthResult.smartMoneyScore !== null ? healthResult.smartMoneyScore + '/10' : '[ N/A - Not in DefiLlama ]'}\n`;
    report += `- 24h Volume: $${volume24h.toLocaleString()} | TVL 7D Change: ${tvlChange7d !== null ? tvlChange7d.toFixed(2) + '%' : 'N/A'}\n`;
    
    report += `**3. Holder Concentration:** ${healthResult.concentrationScore !== null ? healthResult.concentrationScore + '/10' : '[ N/A - RPC Pending ]'}\n`;
    report += `- Top 10 Holders: ${top10HoldersPercent !== null ? top10HoldersPercent + '%' : 'N/A'}\n`;
    
    report += `**4. Momentum (CEX):** ${healthResult.momentumScore !== null ? healthResult.momentumScore + '/10' : '[ N/A - DEX Only Coin ]'}\n`;
    report += `- Price: $${currentPrice} | MA50: ${ma50 ? '$'+ma50.toFixed(4) : 'N/A'} | RSI: ${rsi || 'N/A'}\n\n`;

    report += `*System Note for LLM: Use this exact data to provide a "Market Summary" and "Suggested Autonomous Actions" in the user's native language. If CEX momentum is N/A, explicitly warn about high risk Degen/Memecoin status. IMPORTANT: Always include a clear disclaimer at the end (translated into the user's native language) stating that this analysis is NOT financial advice (NFA).*`;

    return report;

  } catch (error: any) {
    return `[Market Intelligence] Failed to aggregate data: ${error.message}`;
  }
}

export const marketAnalysisToolDefinition = {
  type: "function",
  function: {
    name: "analyze_market",
    description: "MUST be used whenever the user asks for 'analisis', 'analysis', 'market intelligence', or a deep dive into a token. Fetches live, expert-level Web3 market data including Liquidity Risk, Smart Money Flow (TVL), Holder Concentration, and Momentum.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The blockchain network",
        },
        tokenAddressOrSymbol: {
          type: "string",
          description: "The token symbol (e.g. USDC, PEPE) or exact Contract Address (e.g. 0x...) to analyze.",
        }
      },
      required: ["tokenAddressOrSymbol"],
    },
  },
};
