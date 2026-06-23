import { CanonicalRouteQuote, QuoteRequest } from './types';

export class QuoteValidator {
  public validate(quote: CanonicalRouteQuote, request: QuoteRequest): string | null {
    if (!quote) return "Quote is null";

    if (!quote.executable) {
      return "Quote is marked as not executable";
    }

    if (Date.now() > quote.expiresAt) {
      return "Quote has expired";
    }

    if (quote.inputAmount <= 0n) {
      return "Input amount must be greater than zero";
    }

    if (quote.outputAmount <= 0n) {
      return "Output amount must be greater than zero";
    }

    // Verify token amounts match request conceptually (though raw values might differ slightly if fees are taken from input)
    // We assume the provider has matched the request

    if (!quote.execution || !quote.execution.target || !quote.execution.calldata) {
      return "Missing execution payload (target or calldata)";
    }

    // Slippage validation - if provider returned priceImpact, check if it exceeds tolerance
    if (request.slippageTolerance !== "auto" && quote.priceImpactBps) {
      const toleranceBps = request.slippageTolerance * 100;
      if (quote.priceImpactBps > toleranceBps) {
         return `Price impact (${quote.priceImpactBps / 100}%) exceeds tolerance (${request.slippageTolerance}%)`;
      }
    }

    return null; // Valid
  }
}

export const quoteValidator = new QuoteValidator();
