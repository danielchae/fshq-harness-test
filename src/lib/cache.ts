// Cache for data fetching hooks
// Provides SWR-like stale-while-revalidate behavior with sessionStorage persistence

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  fetchedAt?: number; // When the data was fetched (vs when it was cached)
}

type CacheStore = Record<string, CacheEntry<unknown>>;

// Default stale time: 10 seconds
// Data is considered fresh for 10 seconds after being cached
// This allows navigation between pages to use cache without refetch
// Reloads are handled separately via isReload detection
const DEFAULT_STALE_TIME = 10000;

// Track which cache keys have been revalidated in this page session
// This resets on page reload but persists during SPA navigation
const revalidatedKeys = new Set<string>();

// Prefix for sessionStorage keys
const STORAGE_PREFIX = 'app_cache:';

// In-memory cache for subscribers and quick access
const memoryCache: CacheStore = {};

// Subscribers for cache updates
const subscribers = new Map<string, Set<() => void>>();

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Detect if this page load is a reload (vs fresh navigation)
// On reload, we want to revalidate cached data
const isReload =
  isBrowser &&
  (() => {
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const firstEntry = navEntries[0];
      if (firstEntry) {
        return firstEntry.type === 'reload';
      }
      // Fallback for older browsers
      return performance.navigation?.type === 1;
    } catch {
      return false;
    }
  })();

// Load cache from sessionStorage on initialization
function loadFromStorage(): void {
  if (!isBrowser) return;

  try {
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
    keys.forEach((storageKey) => {
      const key = storageKey.replace(STORAGE_PREFIX, '');
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        try {
          memoryCache[key] = JSON.parse(stored);
        } catch {
          // Invalid JSON, remove the entry
          sessionStorage.removeItem(storageKey);
        }
      }
    });
  } catch {
    // sessionStorage might not be available
  }
}

// Initialize cache from storage
loadFromStorage();

function saveToStorage(key: string, entry: CacheEntry<unknown>): void {
  if (!isBrowser) return;

  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage might be full or not available
  }
}

function removeFromStorage(key: string): void {
  if (!isBrowser) return;

  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // Ignore errors
  }
}

export function getCachedData<T>(key: string): { data: T | undefined; isStale: boolean; needsRevalidation: boolean } {
  // First check memory cache
  let entry = memoryCache[key] as CacheEntry<T> | undefined;

  // If not in memory, try to load from sessionStorage
  if (!entry && isBrowser) {
    try {
      const stored = sessionStorage.getItem(STORAGE_PREFIX + key);
      if (stored) {
        entry = JSON.parse(stored);
        if (entry) {
          memoryCache[key] = entry;
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  if (!entry) {
    return { data: undefined, isStale: false, needsRevalidation: false };
  }

  const now = Date.now();
  const isStale = now - entry.timestamp > DEFAULT_STALE_TIME;

  // Data needs revalidation if:
  // 1. It's stale AND hasn't been revalidated this page session, OR
  // 2. This is a page reload (user explicitly refreshed)
  // On page reload, we always revalidate to get fresh data
  const needsRevalidation = (isStale || isReload) && !revalidatedKeys.has(key);

  return { data: entry.data, isStale, needsRevalidation };
}

// Mark a key as revalidated for this page session
export function markRevalidated(key: string): void {
  revalidatedKeys.add(key);
}

export function setCachedData<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
  };

  memoryCache[key] = entry;
  saveToStorage(key, entry);

  // Notify all subscribers of this key
  const keySubscribers = subscribers.get(key);
  if (keySubscribers) {
    keySubscribers.forEach((callback) => callback());
  }
}

export function invalidateCache(key: string): void {
  const entry = memoryCache[key];
  if (entry) {
    // Mark as stale by setting timestamp to 0
    entry.timestamp = 0;
    saveToStorage(key, entry);
  }
}

export function clearCache(key?: string): void {
  if (key) {
    delete memoryCache[key];
    removeFromStorage(key);
  } else {
    Object.keys(memoryCache).forEach((k) => {
      delete memoryCache[k];
      removeFromStorage(k);
    });
  }
}

export function subscribeToCache(key: string, callback: () => void): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key)!.add(callback);

  // Return unsubscribe function
  return () => {
    const keySubscribers = subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.delete(callback);
      if (keySubscribers.size === 0) {
        subscribers.delete(key);
      }
    }
  };
}

// Generate cache keys for different resources
export function getLeagueCacheKey(slug: string): string {
  return `league:${slug}`;
}

export function getTeamsCacheKey(slug: string): string {
  return `teams:${slug}`;
}

export function getMembersCacheKey(slug: string): string {
  return `members:${slug}`;
}

export function getFeedCacheKey(slug: string): string {
  return `feed:${slug}`;
}
