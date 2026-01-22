/**
 * Sleeper Leagues for User Integration Function (task-64)
 *
 * Fetches all leagues for a Sleeper user from the Sleeper API with:
 * - Exponential backoff retry logic for rate limiting
 * - In-memory caching with 15-minute TTL
 * - Season filtering (defaults to current season)
 * - Type-safe response handling
 */

import type { SleeperLeague } from '@/types/sleeper';

// ============================================================================
// Configuration
// ============================================================================

/** Sleeper API base URL (public, no auth required) */
export const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

/** Cache TTL in milliseconds (15 minutes for leagues list per PRD) */
export const LEAGUES_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes = 900000ms

/** Maximum retry attempts for rate limiting */
export const MAX_RETRIES = 3;

/** Base delay for exponential backoff (in ms) */
const BASE_DELAY_MS = 100;

/** Request timeout (10 seconds) */
const REQUEST_TIMEOUT_MS = 10000;

// ============================================================================
// Types
// ============================================================================

interface LeaguesCacheEntry {
  data: SleeperLeague[];
  expiresAt: number;
  fetchedAt: number;
}

interface FetchLeaguesOptions {
  /** Skip cache and force fetch from API */
  skipCache?: boolean;
  /** Custom timeout in milliseconds */
  timeout?: number;
  /** Season to fetch (defaults to current year) */
  season?: string;
  /** Sport type (defaults to 'nfl') */
  sport?: string;
}

interface FetchLeaguesResult {
  success: true;
  data: SleeperLeague[];
  fromCache: boolean;
  count: number;
}

interface FetchLeaguesError {
  success: false;
  error: string;
  code: 'INVALID_USER_ID' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR';
}

export type FetchSleeperLeaguesForUserResult = FetchLeaguesResult | FetchLeaguesError;

// ============================================================================
// Helper Types for League Metadata
// ============================================================================

/** League type classification based on settings.type */
export type LeagueType = 'redraft' | 'keeper' | 'dynasty' | 'unknown';

/** Convert Sleeper league type number to string type */
export function getLeagueType(typeNum: number | undefined): LeagueType {
  switch (typeNum) {
    case 0:
      return 'redraft';
    case 1:
      return 'keeper';
    case 2:
      return 'dynasty';
    default:
      return 'unknown';
  }
}

/** Generate avatar URL from Sleeper avatar hash */
export function getAvatarUrl(avatarHash: string | null | undefined): string {
  if (!avatarHash) {
    return '/default-league-avatar.png';
  }
  return `https://sleepercdn.com/avatars/${avatarHash}`;
}

// ============================================================================
// In-Memory Cache
// ============================================================================

/**
 * In-memory cache for user leagues data
 * Cache key format: sleeper:leagues:{userId}:{sport}:{season}
 * Uses Map for O(1) lookup performance
 */
const leaguesCache = new Map<string, LeaguesCacheEntry>();

/**
 * Generate cache key for user leagues
 */
function getCacheKey(userId: string, sport: string, season: string): string {
  return `sleeper:leagues:${userId}:${sport}:${season}`;
}

/**
 * Get cached leagues data if available and not expired
 */
function getFromCache(userId: string, sport: string, season: string): SleeperLeague[] | null {
  const key = getCacheKey(userId, sport, season);
  const entry = leaguesCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    // Cache entry has expired, remove it
    leaguesCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store leagues data in cache
 */
function setInCache(userId: string, sport: string, season: string, data: SleeperLeague[]): void {
  const key = getCacheKey(userId, sport, season);
  const now = Date.now();

  leaguesCache.set(key, {
    data,
    fetchedAt: now,
    expiresAt: now + LEAGUES_CACHE_TTL_MS,
  });
}

/**
 * Invalidate cache entry for a user's leagues
 */
export function invalidateLeaguesForUserCache(userId: string, sport = 'nfl', season?: string): void {
  const currentSeason = season || getCurrentSeason();
  const key = getCacheKey(userId, sport, currentSeason);
  leaguesCache.delete(key);
}

/**
 * Invalidate all cached leagues for a user (across all seasons)
 */
export function invalidateAllLeaguesForUser(userId: string): void {
  const keysToDelete: string[] = [];
  leaguesCache.forEach((_, key) => {
    if (key.startsWith(`sleeper:leagues:${userId}:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => leaguesCache.delete(key));
}

/**
 * Clear all cached user leagues data
 */
export function clearLeaguesForUserCache(): void {
  leaguesCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getLeaguesForUserCacheStats(): {
  size: number;
  entries: { userId: string; sport: string; season: string; expiresAt: number; fetchedAt: number; count: number }[];
} {
  const entries: {
    userId: string;
    sport: string;
    season: string;
    expiresAt: number;
    fetchedAt: number;
    count: number;
  }[] = [];

  leaguesCache.forEach((entry, key) => {
    const parts = key.replace('sleeper:leagues:', '').split(':');
    entries.push({
      userId: parts[0] ?? '',
      sport: parts[1] ?? '',
      season: parts[2] ?? '',
      expiresAt: entry.expiresAt,
      fetchedAt: entry.fetchedAt,
      count: entry.data.length,
    });
  });

  return {
    size: leaguesCache.size,
    entries,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current NFL season year
 * Season year is based on when the season starts (usually September)
 * Before September, use previous year
 */
export function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  // NFL season typically starts in September (month 8)
  // If we're before September, use the previous year
  return month < 8 ? (year - 1).toString() : year.toString();
}

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
 * Fetch all leagues for a Sleeper user
 *
 * Features:
 * - Exponential backoff retry on rate limits (429) and network errors
 * - In-memory caching with 15-minute TTL
 * - Season filtering (defaults to current season)
 * - Timeout handling (10 second default)
 * - Returns empty array for users with no leagues
 *
 * @param userId - Sleeper user ID (from fetchSleeperUser result)
 * @param options - Optional fetch configuration
 * @returns Array of SleeperLeague objects
 */
export async function fetchSleeperLeaguesForUser(
  userId: string,
  options: FetchLeaguesOptions = {}
): Promise<SleeperLeague[]> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS, season = getCurrentSeason(), sport = 'nfl' } = options;

  // Validate user ID
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.error('[fetchSleeperLeaguesForUser] Invalid user ID provided');
    return [];
  }

  const normalizedUserId = userId.trim();

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedUserId, sport, season);
    if (cached !== null) {
      return cached;
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/user/${encodeURIComponent(normalizedUserId)}/leagues/${sport}/${season}`;
      const response = await fetchWithTimeout(url, timeout);

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          console.warn(
            `[fetchSleeperLeaguesForUser] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
        console.error('[fetchSleeperLeaguesForUser] Rate limited after max retries');
        return [];
      }

      // Handle other non-OK responses
      if (!response.ok) {
        console.error(`[fetchSleeperLeaguesForUser] API error: ${response.status} ${response.statusText}`);
        return [];
      }

      // Parse response
      const data = await response.json();

      // Sleeper API returns an array of leagues (can be empty)
      if (!Array.isArray(data)) {
        console.error('[fetchSleeperLeaguesForUser] Invalid response structure (expected array)');
        return [];
      }

      // Type-safe cast
      const leagues = data as SleeperLeague[];

      // Cache the successful response (even if empty)
      setInCache(normalizedUserId, sport, season, leagues);

      return leagues;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        console.error(`[fetchSleeperLeaguesForUser] Request timeout for user ${normalizedUserId}`);
        return [];
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[fetchSleeperLeaguesForUser] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}, retrying in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(
    `[fetchSleeperLeaguesForUser] Failed to fetch leagues for user ${normalizedUserId} after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message
  );
  return [];
}

/**
 * Fetch leagues with detailed result including error information
 *
 * @param userId - Sleeper user ID
 * @param options - Optional fetch configuration
 * @returns Result object with success status and data or error details
 */
export async function fetchSleeperLeaguesForUserWithResult(
  userId: string,
  options: FetchLeaguesOptions = {}
): Promise<FetchSleeperLeaguesForUserResult> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS, season = getCurrentSeason(), sport = 'nfl' } = options;

  // Validate user ID
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return {
      success: false,
      error: 'Invalid user ID provided',
      code: 'INVALID_USER_ID',
    };
  }

  const normalizedUserId = userId.trim();

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedUserId, sport, season);
    if (cached !== null) {
      return {
        success: true,
        data: cached,
        fromCache: true,
        count: cached.length,
      };
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;
  let rateLimited = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/user/${encodeURIComponent(normalizedUserId)}/leagues/${sport}/${season}`;
      const response = await fetchWithTimeout(url, timeout);

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

      // Parse response
      const data = await response.json();

      if (!Array.isArray(data)) {
        return {
          success: false,
          error: 'Invalid response structure from Sleeper API (expected array)',
          code: 'API_ERROR',
        };
      }

      const leagues = data as SleeperLeague[];
      setInCache(normalizedUserId, sport, season, leagues);

      return {
        success: true,
        data: leagues,
        fromCache: false,
        count: leagues.length,
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
 * Fetch leagues for multiple seasons at once
 *
 * @param userId - Sleeper user ID
 * @param seasons - Array of season years to fetch
 * @param options - Optional fetch configuration
 * @returns Object mapping season to leagues array
 */
export async function fetchSleeperLeaguesForMultipleSeasons(
  userId: string,
  seasons: string[],
  options: Omit<FetchLeaguesOptions, 'season'> = {}
): Promise<Record<string, SleeperLeague[]>> {
  const results: Record<string, SleeperLeague[]> = {};

  // Fetch all seasons sequentially to respect rate limits
  for (const season of seasons) {
    results[season] = await fetchSleeperLeaguesForUser(userId, {
      ...options,
      season,
    });
  }

  return results;
}

/**
 * Build API endpoint URL for user leagues
 */
export function getLeaguesForUserEndpoint(userId: string, sport = 'nfl', season?: string): string {
  const seasonYear = season || getCurrentSeason();
  return `${SLEEPER_API_BASE}/user/${encodeURIComponent(userId)}/leagues/${sport}/${seasonYear}`;
}
