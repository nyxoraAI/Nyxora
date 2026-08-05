import { CanonicalRouteQuote, QuoteRequest } from './types';

export type RoutePreference = "best_output" | "lowest_fee" | "fastest" | "safest";

/**
 * Gas-Aware Tiebreaker Threshold.
 * If two providers' outputAmount are within this BPS tolerance of each other,
 * we prefer the one with lower gas cost instead.
 * 100 bps = 1%
 */
const GAS_TIEBREAKER_BPS = 100n;

export class RouteScorer {
  public selectBest(quotes: CanonicalRouteQuote[], request: QuoteRequest, preference: RoutePreference = "best_output"): CanonicalRouteQuote | null {
    if (!quotes || quotes.length === 0) return null;

    // Filter out completely invalid outputs
    const validQuotes = quotes.filter(q => q.outputAmount > 0n);
    if (validQuotes.length === 0) return null;

    if (preference === 'lowest_fee') {
      // Sort by total fee (gas + protocol + bridge)
      validQuotes.sort((a, b) => {
        const totalFeeA = (a.estimatedGasUsd || 0) + (a.protocolFeeUsd || 0) + (a.bridgeFeeUsd || 0);
        const totalFeeB = (b.estimatedGasUsd || 0) + (b.protocolFeeUsd || 0) + (b.bridgeFeeUsd || 0);
        return totalFeeA - totalFeeB;
      });
      return validQuotes[0];
    }

    // Default: 'best_output' with gas-aware tiebreaker.
    // Step 1: Sort descending by output amount.
    validQuotes.sort((a, b) => {
      if (a.outputAmount > b.outputAmount) return -1;
      if (a.outputAmount < b.outputAmount) return 1;
      return 0;
    });

    const best = validQuotes[0];

    // Step 2: Gas-aware tiebreaker.
    // If any competitor's output is within GAS_TIEBREAKER_BPS of the best,
    // prefer whichever has the lower gas cost (in USD).
    // This prevents selecting a provider with +0.01% output but 10x the gas cost.
    const contenders = validQuotes.filter(q => {
      if (q === best || best.outputAmount === 0n) return false;
      // Calculate difference in BPS: (best - q) / best * 10000
      const diffBps = ((best.outputAmount - q.outputAmount) * 10000n) / best.outputAmount;
      return diffBps <= GAS_TIEBREAKER_BPS;
    });

    if (contenders.length > 0) {
      const candidates = [best, ...contenders];
      // Among candidates within output tolerance, pick the one with lowest gas
      candidates.sort((a, b) => {
        const gasA = (a.estimatedGasUsd || 0) + (a.bridgeFeeUsd || 0);
        const gasB = (b.estimatedGasUsd || 0) + (b.bridgeFeeUsd || 0);
        return gasA - gasB;
      });
      const winner = candidates[0];
      if (winner !== best) {
        console.log(
          `[RouteScorer] Gas-aware tiebreaker: preferring ${winner.provider} over ${best.provider} ` +
          `(output within ${GAS_TIEBREAKER_BPS} bps tolerance, gas $${(winner.estimatedGasUsd || 0).toFixed(4)} vs $${(best.estimatedGasUsd || 0).toFixed(4)})`
        );
      }
      return winner;
    }

    return best;
  }
}

export const routeScorer = new RouteScorer();
