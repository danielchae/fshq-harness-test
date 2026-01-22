/**
 * Sleeper User Lookup Integration Function (task-63)
 *
 * Fetches user profile from the Sleeper API with:
 * - Exponential backoff retry logic for rate limiting
 * - In-memory caching with 1-hour TTL
 * - Username normalization and validation
 * - Type-safe response handling
 */

import type { SleeperUser } from '@/types/sleeper';

// ============================================================================
// Configuration
// ============================================================================

/** Sleeper API base URL (public, no auth required) */
export const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

/** Cache TTL in milliseconds (1 hour for user data per PRD) */
export const USER_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour = 3600000ms

/** Maximum retry attempts for rate limiting */
export const MAX_RETRIES = 3;

/** Base delay for exponential backoff (in ms) */
const BASE_DELAY_MS = 100;

/** Request timeout (10 seconds) */
const REQUEST_TIMEOUT_MS = 10000;

// ============================================================================
// Types
// ============================================================================

interface UserCacheEntry {
  data: SleeperUser | null;
  expiresAt: number;
  fetchedAt: number;
}

interface FetchUserOptions {
  /** Skip cache and force fetch from API */
  skipCache?: boolean;
  /** Custom timeout in milliseconds */
  timeout?: number;
}

interface FetchUserResult {
  success: true;
  data: SleeperUser;
  fromCache: boolean;
}

interface FetchUserError {
  success: false;
  error: string;
  code: 'NOT_FOUND' | 'INVALID_USERNAME' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR';
}

export type FetchSleeperUserResult = FetchUserResult | FetchUserError;

// ============================================================================
// In-Memory Cache
// ============================================================================

/**
 * In-memory cache for user data
 * Uses Map for O(1) lookup performance
 * Cache key is lowercase username for case-insensitive lookups
 */
const userCache = new Map<string, UserCacheEntry>();

/**
 * Generate cache key for a user (normalized to lowercase)
 */
function getCacheKey(username: string): string {
  return `sleeper:user:${username.toLowerCase().trim()}`;
}

/**
 * Get cached user data if available and not expired
 */
function getFromCache(username: string): SleeperUser | null | undefined {
  const key = getCacheKey(username);
  const entry = userCache.get(key);

  if (!entry) {
    return undefined; // Not in cache
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    // Cache entry has expired, remove it
    userCache.delete(key);
    return undefined;
  }

  return entry.data; // Could be null if user wasn't found
}

/**
 * Store user data in cache (including null for not found)
 */
function setInCache(username: string, data: SleeperUser | null): void {
  const key = getCacheKey(username);
  const now = Date.now();

  userCache.set(key, {
    data,
    fetchedAt: now,
    expiresAt: now + USER_CACHE_TTL_MS,
  });
}

/**
 * Invalidate cache entry for a user
 */
export function invalidateUserCache(username: string): void {
  const key = getCacheKey(username);
  userCache.delete(key);
}

/**
 * Clear all cached user data
 */
export function clearUserCache(): void {
  userCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getUserCacheStats(): {
  size: number;
  entries: { username: string; expiresAt: number; fetchedAt: number; hasData: boolean }[];
} {
  const entries: { username: string; expiresAt: number; fetchedAt: number; hasData: boolean }[] = [];

  userCache.forEach((entry, key) => {
    const username = key.replace('sleeper:user:', '');
    entries.push({
      username,
      expiresAt: entry.expiresAt,
      fetchedAt: entry.fetchedAt,
      hasData: entry.data !== null,
    });
  });

  return {
    size: userCache.size,
    entries,
  };
}

// ============================================================================
// Username Validation
// ============================================================================

/**
 * Validate a Sleeper username format
 * Sleeper usernames: 3-25 chars, alphanumeric + underscore
 *
 * @param username - The username to validate
 * @returns An error message or null if valid
 */
export function validateSleeperUsername(username: string): string | null {
  if (!username || username.trim().length === 0) {
    return 'Please enter a Sleeper username';
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters';
  }

  if (trimmed.length > 25) {
    return 'Username must be less than 25 characters';
  }

  // Sleeper usernames are alphanumeric with underscores
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores';
  }

  return null;
}

/**
 * Normalize username for consistent API calls
 */
export function normalizeUsername(username: string): string {
  return username.toLowerCase().trim();
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
 * Fetch Sleeper user profile by username
 *
 * Features:
 * - Exponential backoff retry on rate limits (429) and network errors
 * - In-memory caching with 1-hour TTL
 * - Case-insensitive username lookup (cached by lowercase)
 * - Timeout handling (10 second default)
 * - Returns null for user not found (Sleeper API returns null, not 404)
 *
 * @param username - Sleeper username
 * @param options - Optional fetch configuration
 * @returns SleeperUser data or null if not found
 */
export async function fetchSleeperUser(username: string, options: FetchUserOptions = {}): Promise<SleeperUser | null> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Validate username format
  const validationError = validateSleeperUsername(username);
  if (validationError) {
    console.error(`[fetchSleeperUser] ${validationError}`);
    return null;
  }

  const normalizedUsername = normalizeUsername(username);

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedUsername);
    if (cached !== undefined) {
      // Found in cache (could be null for known not-found users)
      return cached;
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Sleeper API endpoint for user lookup by username
      const url = `${SLEEPER_API_BASE}/user/${encodeURIComponent(normalizedUsername)}`;
      const response = await fetchWithTimeout(url, timeout);

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          console.warn(
            `[fetchSleeperUser] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
        console.error('[fetchSleeperUser] Rate limited after max retries');
        return null;
      }

      // Handle other non-OK responses
      if (!response.ok) {
        console.error(`[fetchSleeperUser] API error: ${response.status} ${response.statusText}`);
        return null;
      }

      // Parse response
      const data = await response.json();

      // Sleeper API returns null for unknown users (not 404)
      if (data === null) {
        // Cache the not-found result to avoid repeated lookups
        setInCache(normalizedUsername, null);
        return null;
      }

      // Validate that we received a user object
      if (!data || typeof data !== 'object' || !data.user_id || !data.username) {
        console.error('[fetchSleeperUser] Invalid response structure');
        return null;
      }

      // Type-safe cast with required fields validation
      const user: SleeperUser = {
        user_id: data.user_id,
        username: data.username,
        display_name: data.display_name || data.username,
        avatar: data.avatar,
      };

      // Cache the successful response
      setInCache(normalizedUsername, user);

      return user;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        console.error(`[fetchSleeperUser] Request timeout for user ${normalizedUsername}`);
        return null;
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[fetchSleeperUser] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}, retrying in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(
    `[fetchSleeperUser] Failed to fetch user ${normalizedUsername} after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message
  );
  return null;
}

/**
 * Fetch user with detailed result including error information
 *
 * @param username - Sleeper username
 * @param options - Optional fetch configuration
 * @returns Result object with success status and data or error details
 */
export async function fetchSleeperUserWithResult(
  username: string,
  options: FetchUserOptions = {}
): Promise<FetchSleeperUserResult> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Validate username format
  const validationError = validateSleeperUsername(username);
  if (validationError) {
    return {
      success: false,
      error: validationError,
      code: 'INVALID_USERNAME',
    };
  }

  const normalizedUsername = normalizeUsername(username);

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedUsername);
    if (cached !== undefined) {
      if (cached === null) {
        return {
          success: false,
          error: `User '${username}' not found`,
          code: 'NOT_FOUND',
        };
      }
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
      const url = `${SLEEPER_API_BASE}/user/${encodeURIComponent(normalizedUsername)}`;
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

      // Sleeper API returns null for unknown users
      if (data === null) {
        setInCache(normalizedUsername, null);
        return {
          success: false,
          error: `User '${username}' not found`,
          code: 'NOT_FOUND',
        };
      }

      // Validate response structure
      if (!data || typeof data !== 'object' || !data.user_id || !data.username) {
        return {
          success: false,
          error: 'Invalid response structure from Sleeper API',
          code: 'API_ERROR',
        };
      }

      const user: SleeperUser = {
        user_id: data.user_id,
        username: data.username,
        display_name: data.display_name || data.username,
        avatar: data.avatar,
      };

      setInCache(normalizedUsername, user);

      return {
        success: true,
        data: user,
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
 * Get user's league IDs for a specific sport and season
 *
 * @param userId - Sleeper user ID (from fetchSleeperUser result)
 * @param sport - Sport type (default: 'nfl')
 * @param season - Season year (default: current year)
 * @returns Array of league IDs
 */
export async function fetchUserLeagueIds(
  userId: string,
  sport: string = 'nfl',
  season?: string
): Promise<string[]> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.error('[fetchUserLeagueIds] Invalid user ID provided');
    return [];
  }

  const currentSeason = season || new Date().getFullYear().toString();

  try {
    const url = `${SLEEPER_API_BASE}/user/${encodeURIComponent(userId)}/leagues/${sport}/${currentSeason}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error(`[fetchUserLeagueIds] API error: ${response.status}`);
      return [];
    }

    const leagues = await response.json();

    if (!Array.isArray(leagues)) {
      return [];
    }

    return leagues.map((league: { league_id: string }) => league.league_id);
  } catch (error) {
    console.error('[fetchUserLeagueIds] Error fetching leagues:', error);
    return [];
  }
}

/**
 * Endpoint URL builder for user lookup
 */
export function getUserEndpoint(username: string): string {
  return `${SLEEPER_API_BASE}/user/${encodeURIComponent(normalizeUsername(username))}`;
}
