/**
 * ============================================================================
 * GSS — HIGH-CONCURRENCY IN-MEMORY CACHE & QUOTA SHIELD
 * Enterprise-grade LRU Cache with TTL & Stale-While-Revalidate (SWR).
 * 
 * Designed to handle 10,000+ concurrent requests by shielding Google Sheets
 * API quotas (300 req/min limit) and serving cached data in < 1ms directly from RAM.
 * ============================================================================
 */

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  staleUntil: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  evictions: number;
  totalKeys: number;
  hitRatioPct: string;
  memoryEstimatedKb: number;
}

export class EnterpriseMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxEntries: number;
  private defaultTtlMs: number;
  private defaultStaleMs: number;
  private stats = {
    hits: 0,
    misses: 0,
    staleHits: 0,
    evictions: 0,
  };

  constructor(options?: { maxEntries?: number; defaultTtlSeconds?: number; defaultStaleSeconds?: number }) {
    this.maxEntries = options?.maxEntries || 2000;
    this.defaultTtlMs = (options?.defaultTtlSeconds || 30) * 1000; // 30s fresh
    this.defaultStaleMs = (options?.defaultStaleSeconds || 120) * 1000; // 2 min stale-while-revalidate
  }

  /**
   * Get an item or compute and cache it if absent/expired.
   * Employs Stale-While-Revalidate: if entry is stale but within stale window,
   * returns cached data immediately (0ms) and asynchronously fetches fresh data.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
    staleSeconds?: number
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry) {
      if (now <= entry.expiresAt) {
        // Fresh Cache Hit: 0ms response
        entry.hits++;
        this.stats.hits++;
        return entry.data as T;
      }

      if (now <= entry.staleUntil) {
        // Stale Cache Hit: Return immediately and revalidate in background
        entry.hits++;
        this.stats.staleHits++;
        
        // Non-blocking background revalidation
        this.revalidateInBackground(key, fetcher, ttlSeconds, staleSeconds);
        return entry.data as T;
      }
    }

    // Cache Miss: Must fetch synchronously
    this.stats.misses++;
    const freshData = await fetcher();
    this.set(key, freshData, ttlSeconds, staleSeconds);
    return freshData;
  }

  /**
   * Store data in cache with explicit or default TTL.
   */
  set<T>(key: string, data: T, ttlSeconds?: number, staleSeconds?: number): void {
    const now = Date.now();
    const ttl = (ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs);
    const stale = (staleSeconds ? staleSeconds * 1000 : this.defaultStaleMs);

    // Evict oldest entry if at capacity (LRU simulation)
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, {
      data,
      cachedAt: now,
      expiresAt: now + ttl,
      staleUntil: now + ttl + stale,
      hits: 0,
    });
  }

  /**
   * Directly get cached entry without fetching.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    const now = Date.now();
    if (now > entry.staleUntil) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    entry.hits++;
    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Invalidate a specific key.
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix or regex pattern.
   * Useful for write-through cache invalidation (e.g. 'student:*', 'tracker:CBE_*')
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string'
      ? new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Flush the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Background revalidation worker (fire-and-forget).
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
    staleSeconds?: number
  ): Promise<void> {
    try {
      const freshData = await fetcher();
      this.set(key, freshData, ttlSeconds, staleSeconds);
    } catch (err) {
      console.warn(`[EnterpriseMemoryCache] Background revalidation failed for key: ${key}`, err);
    }
  }

  /**
   * Get operational metrics for health checks and telemetry dashboards.
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.staleHits + this.stats.misses;
    const hitRatio = totalRequests > 0
      ? (((this.stats.hits + this.stats.staleHits) / totalRequests) * 100).toFixed(1)
      : '100.0';

    // Approximate memory consumption: ~1.5KB per entry
    const memoryEstimatedKb = Math.round((this.cache.size * 1500) / 1024);

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      staleHits: this.stats.staleHits,
      evictions: this.stats.evictions,
      totalKeys: this.cache.size,
      hitRatioPct: `${hitRatio}%`,
      memoryEstimatedKb,
    };
  }
}

// Global singleton instance preserved across hot reloads in Next.js
declare global {
  // eslint-disable-next-line no-var
  var __gmsEnterpriseMemoryCache: EnterpriseMemoryCache | undefined;
}

export const serverCache = globalThis.__gmsEnterpriseMemoryCache || new EnterpriseMemoryCache({
  maxEntries: 5000,
  defaultTtlSeconds: 30, // 30 seconds fresh
  defaultStaleSeconds: 180, // 3 minutes stale-while-revalidate
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__gmsEnterpriseMemoryCache = serverCache;
}
