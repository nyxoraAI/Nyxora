import { aggregatorRegistry } from './providerRegistry';
import { quoteValidator } from './quoteValidator';
import { routeScorer, RoutePreference } from './routeScorer';
import { QuoteRequest, CanonicalRouteQuote, ProviderExecutionContext } from './types';
import { loadDefiKeys } from '../../config/defiConfigManager';
import { healthService } from './providerHealthService';
import crypto from 'crypto';
// Dynamic timeout implemented inside fetchBestRoute
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
  let eligibleProviders = aggregatorRegistry.resolveEligibleProviders(request);
  
  if (request.preferredProvider && request.preferredProvider !== "auto") {
    const filteredProviders = eligibleProviders.filter(p => p.manifest.id === request.preferredProvider);
    if (filteredProviders.length > 0) {
      eligibleProviders = filteredProviders;
    } else {
      console.warn(`[RouteSelector] LLM Hallucinated or requested an ineligible provider: '${request.preferredProvider}'. Falling back to automatic provider routing.`);
    }
  }

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

  // 3. Parallel fetch with adaptive timeout
  // Same-chain swaps are fast, but cross-chain bridges (Relay, LiFi) need more time to calculate routes
  const timeoutMs = request.fromChain === request.toChain ? 4000 : 8000;

  const promises = eligibleProviders.map(provider => 
    withTimeout(provider.getQuote(request, context), timeoutMs, controller.signal)
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

  // 4. Collect fulfilled quotes and record health
  const quotes: CanonicalRouteQuote[] = [];
  
  settled.forEach((result, i) => {
    const providerId = eligibleProviders[i].manifest.id;
    if (result.status === 'fulfilled') {
      quotes.push(result.value);
      healthService.recordSuccess(providerId);
    } else {
      console.warn(`[RouteSelector] Provider ${eligibleProviders[i].manifest.name} failed:`, result.reason);
      healthService.recordFailure(providerId, result.reason?.message || "Unknown error");
    }
  });

  if (quotes.length === 0) {
    throw new Error('[RouteSelector] All providers failed or timed out. No route found.');
  }

  // 5. Score and select best
  const bestQuote = routeScorer.selectBest(quotes, request, preference);
  
  // Abort any slow providers still running in background
  controller.abort();

  if (!bestQuote) {
    throw new Error('[RouteSelector] Failed to score quotes. No route found.');
  }

  console.log(`[RouteSelector] Best route found via ${bestQuote.provider} (ID: ${bestQuote.routeId})`);
  return bestQuote;
}
