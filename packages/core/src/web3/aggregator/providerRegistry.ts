import { DefiAggregatorProvider, QuoteRequest } from './types';
import { healthService } from './providerHealthService';
import fs from 'fs';
import path from 'path';

export class AggregatorRegistry {
  private providers: Map<string, DefiAggregatorProvider> = new Map();

  public register(provider: DefiAggregatorProvider) {
    if (this.providers.has(provider.manifest.id)) {
      console.warn(`[AggregatorRegistry] Provider ${provider.manifest.id} is already registered. Skipping duplicate.`);
      return;
    }
    
    // Security check: Provider must NOT ask for signing access
    if (provider.manifest.permissions.walletAccess === 'sign') {
      console.error(`[AggregatorRegistry] BLOCKED Provider ${provider.manifest.id}: Aggregators are not allowed 'sign' wallet access. They must only return transaction payloads.`);
      return;
    }

    this.providers.set(provider.manifest.id, provider);
    console.log(`[AggregatorRegistry] Registered provider: ${provider.manifest.name} (${provider.manifest.id})`);
  }

  public getProvider(id: string): DefiAggregatorProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): DefiAggregatorProvider[] {
    return Array.from(this.providers.values());
  }

  public resolveEligibleProviders(request: QuoteRequest): DefiAggregatorProvider[] {
    const isCrossChain = request.fromChain !== request.toChain;
    
    return this.getAllProviders().filter(provider => {
      // 1. Health check (Circuit Breaker)
      if (healthService.isCircuitOpen(provider.manifest.id)) {
        return false;
      }

      // 2. Cross-chain capability check
      if (isCrossChain && !provider.isCrossChainSupported()) {
        return false;
      }

      // 3. Provider-specific support check
      try {
        if (!provider.supports(request)) {
          return false;
        }
      } catch (e) {
        console.warn(`[AggregatorRegistry] Provider ${provider.manifest.id} supports() threw an error. Skipping.`, e);
        return false;
      }

      return true;
    });
  }

  public async autoDiscover() {
    const providersDir = path.join(__dirname, 'providers');
    if (!fs.existsSync(providersDir)) {
      fs.mkdirSync(providersDir, { recursive: true });
      return;
    }

    const isCompiled = __dirname.includes('dist') || __dirname.includes('build') || process.env.NODE_ENV === 'production';
    const files = fs.readdirSync(providersDir).filter(f => {
      if (f.endsWith('.d.ts')) return false;
      if (isCompiled) return f.endsWith('.js');
      return f.endsWith('.ts') || f.endsWith('.js');
    });
    
    for (const file of files) {
      const fullPath = path.join(providersDir, file);
      try {
        const module = await import(fullPath);
        for (const exported of Object.values(module)) {
          if (typeof exported === 'function') {
            try {
              const instance = new (exported as any)();
              if (instance.manifest && instance.manifest.id && instance.getQuote) {
                this.register(instance);
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.error(`[AggregatorRegistry] Failed to load provider from ${file}:`, e);
      }
    }
  }
}

export const aggregatorRegistry = new AggregatorRegistry();
