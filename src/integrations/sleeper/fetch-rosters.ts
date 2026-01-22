/**
 * Sleeper Rosters Integration Function (task-56)
 *
 * Fetches roster data from the Sleeper API with:
 * - Exponential backoff retry logic for rate limiting
 * - In-memory caching with 30-minute TTL
 * - Type-safe response handling
 */

import type { SleeperRoster } from '@/types/sleeper';
import { SLEEPER_API_BASE, MAX_RETRIES } from './fetch-league';

// ============================================================================
// Configuration
// ============================================================================

/** Cache TTL in milliseconds (30 minutes per PRD) */
const ROSTERS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes = 1800000ms

/** Base delay for exponential backoff (in ms) */
const BASE_DELAY_MS = 100;

/** Request timeout (10 seconds) */
const REQUEST_TIMEOUT_MS = 10000;

// ============================================================================
// Types
// ============================================================================

interface CacheEntry {
  data: SleeperRoster[];
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
  data: SleeperRoster[];
  fromCache: boolean;
}

interface FetchError {
  success: false;
  error: string;
  code: 'NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR';
}

export type FetchSleeperRostersResult = FetchResult | FetchError;

// ============================================================================
// In-Memory Cache
// ============================================================================

/**
 * In-memory cache for roster data
 * Uses Map for O(1) lookup performance
 */
const rostersCache = new Map<string, CacheEntry>();

/**
 * Generate cache key for rosters
 */
function getCacheKey(leagueId: string): string {
  return `sleeper:rosters:${leagueId}`;
}

/**
 * Get cached rosters data if available and not expired
 */
function getFromCache(leagueId: string): SleeperRoster[] | null {
  const key = getCacheKey(leagueId);
  const entry = rostersCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    // Cache entry has expired, remove it
    rostersCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store rosters data in cache
 */
function setInCache(leagueId: string, data: SleeperRoster[]): void {
  const key = getCacheKey(leagueId);
  const now = Date.now();

  rostersCache.set(key, {
    data,
    fetchedAt: now,
    expiresAt: now + ROSTERS_CACHE_TTL_MS,
  });
}

/**
 * Invalidate cache entry for rosters
 */
export function invalidateRostersCache(leagueId: string): void {
  const key = getCacheKey(leagueId);
  rostersCache.delete(key);
}

/**
 * Clear all cached rosters data
 */
export function clearRostersCache(): void {
  rostersCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getRostersCacheStats(): {
  size: number;
  entries: { leagueId: string; expiresAt: number; fetchedAt: number }[];
} {
  const entries: { leagueId: string; expiresAt: number; fetchedAt: number }[] = [];

  rostersCache.forEach((entry, key) => {
    const leagueId = key.replace('sleeper:rosters:', '');
    entries.push({
      leagueId,
      expiresAt: entry.expiresAt,
      fetchedAt: entry.fetchedAt,
    });
  });

  return {
    size: rostersCache.size,
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
 * Fetch all rosters for a league from Sleeper API
 *
 * Features:
 * - Exponential backoff retry on rate limits (429) and network errors
 * - In-memory caching with 30-minute TTL
 * - Timeout handling (10 second default)
 * - Returns empty array for 404 (league not found)
 *
 * @param leagueId - Sleeper league ID
 * @param options - Optional fetch configuration
 * @returns Array of SleeperRoster objects or empty array on error
 */
export async function fetchSleeperRosters(leagueId: string, options: FetchOptions = {}): Promise<SleeperRoster[]> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Validate league ID
  if (!leagueId || typeof leagueId !== 'string' || leagueId.trim() === '') {
    console.error('[fetchSleeperRosters] Invalid league ID provided');
    return [];
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
      const url = `${SLEEPER_API_BASE}/league/${normalizedLeagueId}/rosters`;
      const response = await fetchWithTimeout(url, timeout);

      // Handle 404 - League not found
      if (response.status === 404) {
        return [];
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          console.warn(
            `[fetchSleeperRosters] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
        console.error('[fetchSleeperRosters] Rate limited after max retries');
        return [];
      }

      // Handle other non-OK responses
      if (!response.ok) {
        console.error(`[fetchSleeperRosters] API error: ${response.status} ${response.statusText}`);
        return [];
      }

      // Parse and validate response
      const data = await response.json();

      // Validate that we received an array
      if (!Array.isArray(data)) {
        console.error('[fetchSleeperRosters] Invalid response structure - expected array');
        return [];
      }

      // Type-safe cast with validation
      const rosters = data as SleeperRoster[];

      // Validate roster objects have required fields
      const validRosters = rosters.filter((roster) => {
        return (
          roster &&
          typeof roster === 'object' &&
          typeof roster.roster_id === 'number' &&
          typeof roster.league_id === 'string'
        );
      });

      if (validRosters.length !== rosters.length) {
        console.warn(
          `[fetchSleeperRosters] Filtered ${rosters.length - validRosters.length} invalid roster objects`
        );
      }

      // Cache the successful response
      setInCache(normalizedLeagueId, validRosters);

      return validRosters;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        console.error(`[fetchSleeperRosters] Request timeout for league ${normalizedLeagueId}`);
        return [];
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[fetchSleeperRosters] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}, retrying in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(
    `[fetchSleeperRosters] Failed to fetch rosters for league ${normalizedLeagueId} after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message
  );
  return [];
}

/**
 * Fetch rosters with detailed result including error information
 *
 * @param leagueId - Sleeper league ID
 * @param options - Optional fetch configuration
 * @returns Result object with success status and data or error details
 */
export async function fetchSleeperRostersWithResult(
  leagueId: string,
  options: FetchOptions = {}
): Promise<FetchSleeperRostersResult> {
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
      const url = `${SLEEPER_API_BASE}/league/${normalizedLeagueId}/rosters`;
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

      if (!Array.isArray(data)) {
        return {
          success: false,
          error: 'Invalid response structure from Sleeper API - expected array',
          code: 'API_ERROR',
        };
      }

      const rosters = data as SleeperRoster[];

      // Validate roster objects have required fields
      const validRosters = rosters.filter((roster) => {
        return (
          roster &&
          typeof roster === 'object' &&
          typeof roster.roster_id === 'number' &&
          typeof roster.league_id === 'string'
        );
      });

      setInCache(normalizedLeagueId, validRosters);

      return {
        success: true,
        data: validRosters,
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

/**
 * Maps roster IDs to team records for easier lookup
 *
 * @param rosters - Array of SleeperRoster objects
 * @returns Map of roster_id to record (wins, losses, ties)
 */
export function mapRosterIdsToRecords(
  rosters: SleeperRoster[]
): Map<number, { wins: number; losses: number; ties: number }> {
  const recordMap = new Map<number, { wins: number; losses: number; ties: number }>();

  for (const roster of rosters) {
    const record = {
      wins: roster.settings?.wins ?? 0,
      losses: roster.settings?.losses ?? 0,
      ties: roster.settings?.ties ?? 0,
    };
    recordMap.set(roster.roster_id, record);
  }

  return recordMap;
}

/**
 * Maps owner IDs to roster IDs for owner lookup
 *
 * @param rosters - Array of SleeperRoster objects
 * @returns Map of owner_id to roster_id (excluding rosters without owners)
 */
export function mapOwnerIdsToRosterIds(rosters: SleeperRoster[]): Map<string, number> {
  const ownerMap = new Map<string, number>();

  for (const roster of rosters) {
    if (roster.owner_id) {
      ownerMap.set(roster.owner_id, roster.roster_id);
    }
  }

  return ownerMap;
}

// ============================================================================
// Exports
// ============================================================================

export { ROSTERS_CACHE_TTL_MS };
