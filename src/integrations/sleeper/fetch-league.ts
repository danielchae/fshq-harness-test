/**
 * Sleeper League Integration Function (task-55)
 *
 * Fetches league metadata from the Sleeper API with:
 * - Exponential backoff retry logic for rate limiting
 * - In-memory caching with 1-hour TTL
 * - Type-safe response handling
 */

import type { SleeperLeague } from '@/types/sleeper';

// ============================================================================
// Configuration
// ============================================================================

/** Sleeper API base URL (public, no auth required) */
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

/** Cache TTL in milliseconds (1 hour for league settings per PRD) */
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour = 3600000ms

/** Maximum retry attempts for rate limiting */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (in ms) */
const BASE_DELAY_MS = 100;

/** Request timeout (10 seconds) */
const REQUEST_TIMEOUT_MS = 10000;

// ============================================================================
// Types
// ============================================================================

interface CacheEntry {
  data: SleeperLeague;
  expiresAt: number;
  fetchedAt: number;
}

interface FetchOptions {
  /** Skip cache and force fetch from API */
  skipCache?: boolean;
  /** Custom timeout in milliseconds */
  timeout?: number;
}

interface FetchResult {
  success: true;
  data: SleeperLeague;
  fromCache: boolean;
}

interface FetchError {
  success: false;
  error: string;
  code: 'NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR';
}

export type FetchSleeperLeagueResult = FetchResult | FetchError;

// ============================================================================
// In-Memory Cache
// ============================================================================

/**
 * In-memory cache for league data
 * Uses Map for O(1) lookup performance
 */
const leagueCache = new Map<string, CacheEntry>();

/**
 * Generate cache key for a league
 */
function getCacheKey(leagueId: string): string {
  return `sleeper:league:${leagueId}`;
}

/**
 * Get cached league data if available and not expired
 */
function getFromCache(leagueId: string): SleeperLeague | null {
  const key = getCacheKey(leagueId);
  const entry = leagueCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    // Cache entry has expired, remove it
    leagueCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store league data in cache
 */
function setInCache(leagueId: string, data: SleeperLeague): void {
  const key = getCacheKey(leagueId);
  const now = Date.now();

  leagueCache.set(key, {
    data,
    fetchedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  });
}

/**
 * Invalidate cache entry for a league
 */
export function invalidateLeagueCache(leagueId: string): void {
  const key = getCacheKey(leagueId);
  leagueCache.delete(key);
}

/**
 * Clear all cached league data
 */
export function clearLeagueCache(): void {
  leagueCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): {
  size: number;
  entries: { leagueId: string; expiresAt: number; fetchedAt: number }[];
} {
  const entries: { leagueId: string; expiresAt: number; fetchedAt: number }[] = [];

  leagueCache.forEach((entry, key) => {
    const leagueId = key.replace('sleeper:league:', '');
    entries.push({
      leagueId,
      expiresAt: entry.expiresAt,
      fetchedAt: entry.fetchedAt,
    });
  });

  return {
    size: leagueCache.size,
    entries,
  };
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

/**
 * Calculate delay with exponential backoff and jitter
 * Delay formula: baseDelay * 2^attempt + random jitter (0-100ms)
 */
function calculateBackoffDelay(attempt: number): number {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 100;
  return exponentialDelay + jitter;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Main Fetch Function
// ============================================================================

/**
 * Fetch league metadata from Sleeper API
 *
 * Features:
 * - Exponential backoff retry on rate limits (429) and network errors
 * - In-memory caching with 1-hour TTL
 * - Timeout handling (10 second default)
 * - Returns null for 404 (league not found)
 *
 * @param leagueId - Sleeper league ID
 * @param options - Optional fetch configuration
 * @returns SleeperLeague data or null if not found
 */
export async function fetchSleeperLeague(leagueId: string, options: FetchOptions = {}): Promise<SleeperLeague | null> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Validate league ID
  if (!leagueId || typeof leagueId !== 'string' || leagueId.trim() === '') {
    console.error('[fetchSleeperLeague] Invalid league ID provided');
    return null;
  }

  const normalizedLeagueId = leagueId.trim();

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedLeagueId);
    if (cached) {
      return cached;
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/league/${normalizedLeagueId}`;
      const response = await fetchWithTimeout(url, timeout);

      // Handle 404 - League not found
      if (response.status === 404) {
        return null;
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          console.warn(
            `[fetchSleeperLeague] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
        console.error('[fetchSleeperLeague] Rate limited after max retries');
        return null;
      }

      // Handle other non-OK responses
      if (!response.ok) {
        console.error(`[fetchSleeperLeague] API error: ${response.status} ${response.statusText}`);
        return null;
      }

      // Parse and validate response
      const data = await response.json();

      // Validate that we received a league object
      if (!data || typeof data !== 'object' || !data.league_id) {
        console.error('[fetchSleeperLeague] Invalid response structure');
        return null;
      }

      // Type-safe cast with required fields validation
      const league = data as SleeperLeague;

      // Cache the successful response
      setInCache(normalizedLeagueId, league);

      return league;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        console.error(`[fetchSleeperLeague] Request timeout for league ${normalizedLeagueId}`);
        return null;
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[fetchSleeperLeague] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}, retrying in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(
    `[fetchSleeperLeague] Failed to fetch league ${normalizedLeagueId} after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message
  );
  return null;
}

/**
 * Fetch league with detailed result including error information
 *
 * @param leagueId - Sleeper league ID
 * @param options - Optional fetch configuration
 * @returns Result object with success status and data or error details
 */
export async function fetchSleeperLeagueWithResult(
  leagueId: string,
  options: FetchOptions = {}
): Promise<FetchSleeperLeagueResult> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Validate league ID
  if (!leagueId || typeof leagueId !== 'string' || leagueId.trim() === '') {
    return {
      success: false,
      error: 'Invalid league ID provided',
      code: 'API_ERROR',
    };
  }

  const normalizedLeagueId = leagueId.trim();

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedLeagueId);
    if (cached) {
      return {
        success: true,
        data: cached,
        fromCache: true,
      };
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;
  let rateLimited = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/league/${normalizedLeagueId}`;
      const response = await fetchWithTimeout(url, timeout);

      // Handle 404 - League not found
      if (response.status === 404) {
        return {
          success: false,
          error: `League ${normalizedLeagueId} not found`,
          code: 'NOT_FOUND',
        };
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        rateLimited = true;
        if (attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          await sleep(delay);
          continue;
        }
        return {
          success: false,
          error: 'Rate limited by Sleeper API',
          code: 'RATE_LIMITED',
        };
      }

      // Handle other non-OK responses
      if (!response.ok) {
        return {
          success: false,
          error: `API error: ${response.status} ${response.statusText}`,
          code: 'API_ERROR',
        };
      }

      // Parse and validate response
      const data = await response.json();

      if (!data || typeof data !== 'object' || !data.league_id) {
        return {
          success: false,
          error: 'Invalid response structure from Sleeper API',
          code: 'API_ERROR',
        };
      }

      const league = data as SleeperLeague;
      setInCache(normalizedLeagueId, league);

      return {
        success: true,
        data: league,
        fromCache: false,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          code: 'TIMEOUT',
        };
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    code: rateLimited ? 'RATE_LIMITED' : 'NETWORK_ERROR',
  };
}

// ============================================================================
// Exports
// ============================================================================

export { SLEEPER_API_BASE, CACHE_TTL_MS, MAX_RETRIES };
