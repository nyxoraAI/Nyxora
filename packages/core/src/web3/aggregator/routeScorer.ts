import { CanonicalRouteQuote, QuoteRequest } from './types';

export type RoutePreference = "best_output" | "lowest_fee" | "fastest" | "safest";

export class RouteScorer {
  public selectBest(quotes: CanonicalRouteQuote[], request: QuoteRequest, preference: RoutePreference = "best_output"): CanonicalRouteQuote | null {
    if (!quotes || quotes.length === 0) return null;

    // Filter out completely invalid outputs
    const validQuotes = quotes.filter(q => q.outputAmount > 0n);
    if (validQuotes.length === 0) return null;

    // For now, MVP scoring focuses on 'best_output' utilizing BigInt
    // Real scoring would convert everything to USD to normalize output vs gas cost.
    // Assuming for now that we score heavily on outputAmount minus estimatedGasUsd (if we have a token-to-USD conversion available)
    
    // Simple BigInt output sorting as baseline
    validQuotes.sort((a, b) => {
      let scoreA = a.outputAmount;
      let scoreB = b.outputAmount;

      // In a full implementation, we'd do:
      // scoreA = a.normalizedOutputUsd - a.totalCostUsd - riskPenalty ...
      
      if (scoreA > scoreB) return -1;
      if (scoreA < scoreB) return 1;
      return 0;
    });

    return validQuotes[0];
  }
}

export const routeScorer = new RouteScorer();
