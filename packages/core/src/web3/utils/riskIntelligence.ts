/**
 * Risk Intelligence Module (Deterministic Math)
 * Calculates quantitative scores for Web3 assets to prevent LLM hallucination.
 * All scores are returned on a scale of 0.0 to 10.0
 */

export interface MarketHealthResult {
    liquidityScore: number | null;
    smartMoneyScore: number | null;
    concentrationScore: number | null;
    momentumScore: number | null;
    overallScore: number;
}

export function calculateLiquidityScore(liquidityUsd: number | null, mcapUsd: number | null): number | null {
    if (!liquidityUsd || !mcapUsd || mcapUsd === 0) return null;
    
    const ratio = liquidityUsd / mcapUsd;
    // Ideal ratio is 10% or higher. 
    // Example: ratio 0.10 (10%) = 10.0 score. Ratio 0.01 (1%) = 1.0 score.
    let score = ratio * 100; 
    
    if (score > 10) score = 10;
    if (score < 0) score = 0;
    
    return parseFloat(score.toFixed(1));
}

export function analyzeSmartMoneyFlow(tvlChange7d: number | null, volumeChange24h: number | null, priceChange24h: number | null): number | null {
    if (tvlChange7d === null && volumeChange24h === null) return null;
    
    let score = 5.0; // Baseline
    
    if (tvlChange7d !== null) {
        if (tvlChange7d > 10) score += 2;
        else if (tvlChange7d > 0) score += 1;
        else if (tvlChange7d < -10) score -= 3;
    }
    
    if (volumeChange24h !== null && priceChange24h !== null) {
        // High volume but price dropping = panic selling (bad)
        // High volume but price stable/rising slowly = accumulation (good)
        if (volumeChange24h > 20 && priceChange24h < 0) score -= 2;
        if (volumeChange24h > 20 && priceChange24h > 0 && priceChange24h < 10) score += 2;
    }

    if (score > 10) score = 10;
    if (score < 0) score = 0;
    return parseFloat(score.toFixed(1));
}

export function analyzeHolderConcentration(top10HoldersPercent: number | null): number | null {
    if (top10HoldersPercent === null) return null;
    
    // Less than 20% is excellent (10). More than 80% is terrible (1).
    let score = 10 - ((top10HoldersPercent - 20) / 6);
    
    if (score > 10) score = 10;
    if (score < 1) score = 1;
    
    return parseFloat(score.toFixed(1));
}

export function calculateMomentumScore(rsi: number | null, currentPrice: number | null, ma50: number | null, trendClassification?: string): number | null {
    if (rsi === null && ma50 === null && !trendClassification) return null;
    
    let score = 5.0;
    
    if (trendClassification) {
        if (trendClassification === 'STRONG_BULLISH') return 9.0;
        if (trendClassification === 'BULLISH') return 7.0;
        if (trendClassification === 'BEARISH') return 3.0;
        if (trendClassification === 'STRONG_BEARISH') return 1.0;
    }
    
    if (rsi !== null) {
        if (rsi > 70) score -= 2; // Overbought risk
        else if (rsi < 30) score += 2; // Oversold opportunity
        else score += 1; // Healthy momentum
    }
    
    if (currentPrice !== null && ma50 !== null && ma50 > 0) {
        if (currentPrice > ma50) score += 2; // Uptrend
        else score -= 2; // Downtrend
    }
    
    if (score > 10) score = 10;
    if (score < 0) score = 0;
    return parseFloat(score.toFixed(1));
}

export function generateMarketHealthReport(
    liquidityUsd: number | null, mcapUsd: number | null,
    tvlChange7d: number | null, volumeChange24h: number | null, priceChange24h: number | null,
    top10HoldersPercent: number | null,
    rsi: number | null, currentPrice: number | null, ma50: number | null,
    trendClassification?: string
): MarketHealthResult {
    
    const liquidityScore = calculateLiquidityScore(liquidityUsd, mcapUsd);
    const smartMoneyScore = analyzeSmartMoneyFlow(tvlChange7d, volumeChange24h, priceChange24h);
    const concentrationScore = analyzeHolderConcentration(top10HoldersPercent);
    const momentumScore = calculateMomentumScore(rsi, currentPrice, ma50, trendClassification);
    
    let totalValidScores = 0;
    let sumScores = 0;
    
    const scores = [liquidityScore, smartMoneyScore, concentrationScore, momentumScore];
    scores.forEach(s => {
        if (s !== null) {
            sumScores += s;
            totalValidScores++;
        }
    });
    
    // Default to 1.0 if completely untrackable (maximum risk)
    const overallScore = totalValidScores > 0 ? parseFloat((sumScores / totalValidScores).toFixed(1)) : 1.0;
    
    return {
        liquidityScore,
        smartMoneyScore,
        concentrationScore,
        momentumScore,
        overallScore
    };
}
