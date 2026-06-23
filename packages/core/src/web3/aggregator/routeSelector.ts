import { aggregatorRegistry } from './providerRegistry';
import { quoteValidator } from './quoteValidator';
import { routeScorer, RoutePreference } from './routeScorer';
import { QuoteRequest, CanonicalRouteQuote, ProviderExecutionContext } from './types';
import { loadDefiKeys } from '../../config/defiConfigManager';
import crypto from 'crypto';

const PROVIDER_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Provider timeout')), ms);
    
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Request aborted'));
    };

    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort);

    promise.then(
      (res) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

export async function fetchBestRoute(
  request: QuoteRequest,
  preference: RoutePreference = "best_output"
): Promise<CanonicalRouteQuote> {
  // 1. Resolve eligible providers
  const eligibleProviders = aggregatorRegistry.resolveEligibleProviders(request);
  if (eligibleProviders.length === 0) {
    throw new Error('[RouteSelector] No eligible providers found for this route.');
  }

  // 2. Setup execution context
  const controller = new AbortController();
  const keys = loadDefiKeys();
  const context: ProviderExecutionContext = {
    requestId: crypto.randomUUID(),
    abortSignal: controller.signal,
    apiKeys: keys
  };

  // 3. Parallel fetch with timeout
  const promises = eligibleProviders.map(provider => 
    withTimeout(provider.getQuote(request, context), PROVIDER_TIMEOUT_MS, controller.signal)
      .then(quote => {
        // Validate immediately after receiving
        const error = quoteValidator.validate(quote, request);
        if (error) {
          throw new Error(`Invalid quote from ${provider.manifest.name}: ${error}`);
        }
        return quote;
      })
  );

  const settled = await Promise.allSettled(promises);

  // 4. Collect fulfilled quotes
  const quotes = settled
    .filter((result): result is PromiseFulfilledResult<CanonicalRouteQuote> => result.status === 'fulfilled')
    .map(result => result.value);

  if (quotes.length === 0) {
    // Log reasons for failure
    settled.forEach((res, i) => {
      if (res.status === 'rejected') {
        console.warn(`[RouteSelector] Provider ${eligibleProviders[i].manifest.name} failed:`, res.reason);
      }
    });
    throw new Error('[RouteSelector] All providers failed or timed out. No route found.');
  }

  // 5. Score and select best
  const bestQuote = routeScorer.selectBest(quotes, request, preference);
  
  if (!bestQuote) {
    throw new Error('[RouteSelector] Failed to score quotes. No route found.');
  }

  console.log(`[RouteSelector] Best route found via ${bestQuote.provider} (ID: ${bestQuote.routeId})`);
  return bestQuote;
}
