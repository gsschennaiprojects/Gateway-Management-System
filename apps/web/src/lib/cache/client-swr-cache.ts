/**
 * ============================================================================
 * GSS — CLIENT-SIDE SWR & ZERO-LATENCY IN-MEMORY CACHE
 * Provides 0ms instant tab switching and smooth navigation.
 * ============================================================================
 */

interface ClientCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const clientMemoryStore = new Map<string, ClientCacheEntry<any>>();

export const clientSwrCache = {
  /**
   * Get cached data if available and not completely expired (defaults to 60s).
   */
  get<T>(key: string): T | null {
    const entry = clientMemoryStore.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.expiresAt) {
      clientMemoryStore.delete(key);
      return null;
    }
    return entry.data as T;
  },

  /**
   * Store data in browser RAM with TTL.
   */
  set<T>(key: string, data: T, ttlSeconds = 60): void {
    const now = Date.now();
    clientMemoryStore.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlSeconds * 1000,
    });
  },

  /**
   * Invalidate a key or pattern from client cache.
   */
  invalidate(keyOrPattern: string): void {
    if (keyOrPattern.includes('*')) {
      const regex = new RegExp('^' + keyOrPattern.replace(/\*/g, '.*') + '$');
      for (const k of clientMemoryStore.keys()) {
        if (regex.test(k)) clientMemoryStore.delete(k);
      }
    } else {
      clientMemoryStore.delete(keyOrPattern);
    }
  },

  /**
   * Fetch with SWR pattern:
   * 1. Returns cached value immediately if present.
   * 2. Runs network fetch in background to refresh cache and trigger onUpdate callback.
   */
  async fetchWithSwr<T>(
    key: string,
    fetcher: () => Promise<T>,
    onUpdate?: (freshData: T) => void,
    ttlSeconds = 60
  ): Promise<T> {
    const cached = this.get<T>(key);

    // Trigger background refresh
    fetcher()
      .then((fresh) => {
        this.set(key, fresh, ttlSeconds);
        if (onUpdate && JSON.stringify(cached) !== JSON.stringify(fresh)) {
          onUpdate(fresh);
        }
      })
      .catch((err) => {
        console.warn(`[ClientSwrCache] Background refresh failed for ${key}:`, err);
      });

    if (cached !== null) {
      return cached;
    }

    // First time load: must await
    const fresh = await fetcher();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  },
};
