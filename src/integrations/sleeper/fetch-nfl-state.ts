/**
 * Sleeper NFL State Integration Function (task-60)
 *
 * Fetches current NFL season state from the Sleeper API with:
 * - Global caching (single cached value for all requests)
 * - 1-hour TTL for season state
 * - Exponential backoff retry logic for rate limiting
 * - Type-safe response handling
 *
 * API Endpoint: GET https://api.sleeper.app/v1/state/nfl
 */

import type { SleeperNFLState, SleeperSeasonType } from '@/types/sleeper';

// ============================================================================
// Configuration
// ============================================================================

/** Sleeper API base URL (public, no auth required) */
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

/** Cache TTL in milliseconds (1 hour for global season state per PRD) */
export const NFL_STATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour = 3600000ms

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
  data: SleeperNFLState;
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
  data: SleeperNFLState;
  fromCache: boolean;
}

interface FetchError {
  success: false;
  error: string;
  code: 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR';
}

export type FetchSleeperNFLStateResult = FetchResult | FetchError;

// ============================================================================
// Helper Types for Computed Values
// ============================================================================

export interface NFLStateInfo {
  /** Current NFL state from API */
  state: SleeperNFLState;
  /** Whether we're in the regular season */
  isRegularSeason: boolean;
  /** Whether we're in preseason */
  isPreseason: boolean;
  /** Whether we're in postseason (playoffs) */
  isPostseason: boolean;
  /** Whether we're in offseason */
  isOffseason: boolean;
  /** Whether games could be in progress (during regular/post season) */
  gamesCouldBeInProgress: boolean;
}

export interface PlayoffWeekRanges {
  /** Week when playoffs start (typically 15) */
  playoffStartWeek: number;
  /** Championship week (typically 16 or 17) */
  championshipWeek: number;
  /** Last week of regular season (typically 14) */
  regularSeasonEndWeek: number;
  /** Whether the current week is a playoff week */
  isPlayoffWeek: boolean;
  /** Whether the current week is championship week */
  isChampionshipWeek: boolean;
}

// ============================================================================
// In-Memory Cache (Global/Singleton)
// ============================================================================

/**
 * Global cache for NFL state
 * Uses a single cached value since NFL state is global (not per-league)
 */
let nflStateCache: CacheEntry | null = null;

/**
 * Get cached NFL state if available and not expired
 */
function getFromCache(): SleeperNFLState | null {
  if (!nflStateCache) {
    return null;
  }

  const now = Date.now();
  if (now >= nflStateCache.expiresAt) {
    // Cache entry has expired, clear it
    nflStateCache = null;
    return null;
  }

  return nflStateCache.data;
}

/**
 * Store NFL state in cache
 */
function setInCache(data: SleeperNFLState): void {
  const now = Date.now();

  nflStateCache = {
    data,
    fetchedAt: now,
    expiresAt: now + NFL_STATE_CACHE_TTL_MS,
  };
}

/**
 * Invalidate the NFL state cache
 */
export function invalidateNFLStateCache(): void {
  nflStateCache = null;
}

/**
 * Clear the NFL state cache (alias for invalidateNFLStateCache)
 */
export function clearNFLStateCache(): void {
  nflStateCache = null;
}

/**
 * Get cache statistics for monitoring
 */
export function getNFLStateCacheStats(): {
  cached: boolean;
  expiresAt: number | null;
  fetchedAt: number | null;
  ttlRemaining: number | null;
} {
  if (!nflStateCache) {
    return {
      cached: false,
      expiresAt: null,
      fetchedAt: null,
      ttlRemaining: null,
    };
  }

  const now = Date.now();
  const ttlRemaining = Math.max(0, nflStateCache.expiresAt - now);

  return {
    cached: true,
    expiresAt: nflStateCache.expiresAt,
    fetchedAt: nflStateCache.fetchedAt,
    ttlRemaining,
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
// Response Validation
// ============================================================================

/**
 * Validate that a response is a valid SleeperNFLState object
 */
function isValidNFLState(data: unknown): data is SleeperNFLState {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const state = data as Record<string, unknown>;

  // Required fields
  if (typeof state.week !== 'number') return false;
  if (typeof state.season !== 'string') return false;
  if (typeof state.season_type !== 'string') return false;
  if (typeof state.display_week !== 'number') return false;

  // Validate season_type is one of the expected values
  const validSeasonTypes: SleeperSeasonType[] = ['pre', 'regular', 'post', 'off'];
  if (!validSeasonTypes.includes(state.season_type as SleeperSeasonType)) {
    return false;
  }

  return true;
}

// ============================================================================
// Main Fetch Function
// ============================================================================

/**
 * Fetch NFL state from Sleeper API
 *
 * Features:
 * - Global caching with 1-hour TTL (single cached value for all requests)
 * - Exponential backoff retry on rate limits (429) and network errors
 * - Timeout handling (10 second default)
 *
 * @param options - Optional fetch configuration
 * @returns SleeperNFLState data or null on error
 */
export async function fetchSleeperNFLState(options: FetchOptions = {}): Promise<SleeperNFLState | null> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache();
    if (cached) {
      return cached;
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/state/nfl`;
      const response = await fetchWithTimeout(url, timeout);

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          console.warn(
            `[fetchSleeperNFLState] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
        console.error('[fetchSleeperNFLState] Rate limited after max retries');
        return null;
      }

      // Handle other non-OK responses
      if (!response.ok) {
        console.error(`[fetchSleeperNFLState] API error: ${response.status} ${response.statusText}`);
        return null;
      }

      // Parse and validate response
      const data = await response.json();

      // Validate response structure
      if (!isValidNFLState(data)) {
        console.error('[fetchSleeperNFLState] Invalid response structure');
        return null;
      }

      // Cache the successful response
      setInCache(data);

      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        console.error('[fetchSleeperNFLState] Request timeout');
        return null;
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[fetchSleeperNFLState] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}, retrying in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(
    `[fetchSleeperNFLState] Failed to fetch NFL state after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message
  );
  return null;
}

/**
 * Fetch NFL state with detailed result including error information
 *
 * @param options - Optional fetch configuration
 * @returns Result object with success status and data or error details
 */
export async function fetchSleeperNFLStateWithResult(options: FetchOptions = {}): Promise<FetchSleeperNFLStateResult> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache();
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
      const url = `${SLEEPER_API_BASE}/state/nfl`;
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

      // Parse and validate response
      const data = await response.json();

      if (!isValidNFLState(data)) {
        return {
          success: false,
          error: 'Invalid response structure from Sleeper API',
          code: 'API_ERROR',
        };
      }

      setInCache(data);

      return {
        success: true,
        data,
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
// Helper Functions
// ============================================================================

/**
 * Get detailed NFL state information with computed properties
 *
 * @param state - SleeperNFLState object
 * @returns NFLStateInfo with computed season information
 */
export function getNFLStateInfo(state: SleeperNFLState): NFLStateInfo {
  return {
    state,
    isRegularSeason: state.season_type === 'regular',
    isPreseason: state.season_type === 'pre',
    isPostseason: state.season_type === 'post',
    isOffseason: state.season_type === 'off',
    gamesCouldBeInProgress: state.season_type === 'regular' || state.season_type === 'post',
  };
}

/**
 * Get playoff week ranges with standard fantasy football defaults
 * Note: Actual playoff weeks depend on league settings
 *
 * @param state - SleeperNFLState object
 * @param playoffStartWeek - Optional custom playoff start week (default: 15)
 * @param championshipWeek - Optional custom championship week (default: 16)
 * @returns PlayoffWeekRanges with computed playoff information
 */
export function getPlayoffWeekRanges(
  state: SleeperNFLState,
  playoffStartWeek = 15,
  championshipWeek = 16
): PlayoffWeekRanges {
  const regularSeasonEndWeek = playoffStartWeek - 1;

  return {
    playoffStartWeek,
    championshipWeek,
    regularSeasonEndWeek,
    isPlayoffWeek: state.week >= playoffStartWeek && state.season_type === 'regular',
    isChampionshipWeek: state.week === championshipWeek && state.season_type === 'regular',
  };
}

/**
 * Check if pick'ems should be enabled based on NFL state
 *
 * @param state - SleeperNFLState object
 * @returns boolean indicating if pick'ems should be enabled
 */
export function isPickemsEnabled(state: SleeperNFLState): boolean {
  return state.season_type === 'regular' && state.week > 0;
}

/**
 * Get the current NFL week for display purposes
 *
 * @param state - SleeperNFLState object
 * @returns Display string for current week
 */
export function getCurrentWeekDisplay(state: SleeperNFLState): string {
  switch (state.season_type) {
    case 'off':
      return 'Offseason';
    case 'pre':
      return `Preseason Week ${state.display_week}`;
    case 'regular':
      return `Week ${state.display_week}`;
    case 'post':
      return `Playoffs Week ${state.display_week}`;
    default:
      return `Week ${state.display_week}`;
  }
}

/**
 * Fetch NFL state and return info with computed properties
 * Convenience function combining fetch and info extraction
 *
 * @param options - Optional fetch configuration
 * @returns NFLStateInfo or null on error
 */
export async function fetchSleeperNFLStateInfo(options: FetchOptions = {}): Promise<NFLStateInfo | null> {
  const state = await fetchSleeperNFLState(options);
  if (!state) {
    return null;
  }
  return getNFLStateInfo(state);
}
