import { ProviderHealth } from './types';

export class ProviderHealthService {
  private healthCache: Map<string, ProviderHealth> = new Map();
  private readonly cooldownMs = 60000;
  private readonly maxFails = 3;
  private failCounts: Map<string, number> = new Map();

  public getHealth(providerId: string): ProviderHealth | undefined {
    return this.healthCache.get(providerId);
  }

  public recordSuccess(providerId: string) {
    this.failCounts.set(providerId, 0);
    this.healthCache.set(providerId, {
      ok: true,
      checkedAt: Date.now()
    });
  }

  public recordFailure(providerId: string, reason: string) {
    const currentFails = (this.failCounts.get(providerId) || 0) + 1;
    this.failCounts.set(providerId, currentFails);
    
    if (currentFails >= this.maxFails) {
      console.warn(`[HealthService] Circuit breaker OPEN for ${providerId}. Cooldown: ${this.cooldownMs}ms`);
      this.healthCache.set(providerId, {
        ok: false,
        reason: `Circuit open due to multiple failures: ${reason}`,
        checkedAt: Date.now()
      });
    } else {
      console.warn(`[HealthService] Failure for ${providerId} (${currentFails}/${this.maxFails}): ${reason}`);
    }
  }

  public isCircuitOpen(providerId: string): boolean {
    const health = this.healthCache.get(providerId);
    if (!health || health.ok) return false;

    // Check if cooldown has expired (half-open)
    if (Date.now() - health.checkedAt > this.cooldownMs) {
      // Half-open: allow one request through
      return false;
    }

    return true;
  }
}

export const healthService = new ProviderHealthService();
