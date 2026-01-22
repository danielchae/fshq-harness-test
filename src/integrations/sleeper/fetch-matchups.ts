/**
 * Sleeper Matchups Integration Function (task-57)
 *
 * Fetches weekly matchup data from the Sleeper API with:
 * - Exponential backoff retry logic for rate limiting
 * - In-memory caching with 5-minute TTL (during games)
 * - Type-safe response handling
 * - Matchup completion status determination
 */

import type { SleeperMatchup } from '@/types/sleeper';
import { SLEEPER_API_BASE, MAX_RETRIES } from './fetch-league';

// ============================================================================
// Configuration
// ============================================================================

/** Cache TTL in milliseconds (5 minutes during games per PRD) */
const MATCHUPS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes = 300000ms

/** Base delay for exponential backoff (in ms) */
const BASE_DELAY_MS = 100;

/** Request timeout (10 seconds) */
const REQUEST_TIMEOUT_MS = 10000;

// ============================================================================
// Types
// ============================================================================

interface CacheEntry {
  data: SleeperMatchup[];
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
  data: SleeperMatchup[];
  fromCache: boolean;
}

interface FetchError {
  success: false;
  error: string;
  code: 'NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR' | 'INVALID_WEEK';
}

export type FetchSleeperMatchupsResult = FetchResult | FetchError;

/** Paired matchup with both teams and derived status */
export interface MatchupPair {
  matchupId: number;
  team1: SleeperMatchup;
  team2: SleeperMatchup;
  winner: number | null;
  isTie: boolean;
}

// ============================================================================
// In-Memory Cache
// ============================================================================

/**
 * In-memory cache for matchup data
 * Uses Map for O(1) lookup performance
 */
const matchupsCache = new Map<string, CacheEntry>();

/**
 * Generate cache key for matchups (keyed by league + week)
 */
function getCacheKey(leagueId: string, week: number): string {
  return `sleeper:matchups:${leagueId}:${week}`;
}

/**
 * Get cached matchups data if available and not expired
 */
function getFromCache(leagueId: string, week: number): SleeperMatchup[] | null {
  const key = getCacheKey(leagueId, week);
  const entry = matchupsCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    // Cache entry has expired, remove it
    matchupsCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store matchups data in cache
 */
function setInCache(leagueId: string, week: number, data: SleeperMatchup[]): void {
  const key = getCacheKey(leagueId, week);
  const now = Date.now();

  matchupsCache.set(key, {
    data,
    fetchedAt: now,
    expiresAt: now + MATCHUPS_CACHE_TTL_MS,
  });
}

/**
 * Invalidate cache entry for matchups
 */
export function invalidateMatchupsCache(leagueId: string, week: number): void {
  const key = getCacheKey(leagueId, week);
  matchupsCache.delete(key);
}

/**
 * Invalidate all matchup cache entries for a league
 */
export function invalidateLeagueMatchupsCache(leagueId: string): void {
  const keysToDelete: string[] = [];

  matchupsCache.forEach((_, key) => {
    if (key.startsWith(`sleeper:matchups:${leagueId}:`)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => matchupsCache.delete(key));
}

/**
 * Clear all cached matchups data
 */
export function clearMatchupsCache(): void {
  matchupsCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getMatchupsCacheStats(): {
  size: number;
  entries: { leagueId: string; week: number; expiresAt: number; fetchedAt: number }[];
} {
  const entries: { leagueId: string; week: number; expiresAt: number; fetchedAt: number }[] = [];

  matchupsCache.forEach((entry, key) => {
    // Parse key: sleeper:matchups:{leagueId}:{week}
    const parts = key.split(':');
    if (parts.length === 4 && parts[2] && parts[3]) {
      entries.push({
        leagueId: parts[2],
        week: parseInt(parts[3], 10),
        expiresAt: entry.expiresAt,
        fetchedAt: entry.fetchedAt,
      });
    }
  });

  return {
    size: matchupsCache.size,
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
 * Fetch matchups for a specific week from Sleeper API
 *
 * Features:
 * - Exponential backoff retry on rate limits (429) and network errors
 * - In-memory caching with 5-minute TTL (during games)
 * - Timeout handling (10 second default)
 * - Returns empty array for 404 (league not found)
 *
 * @param leagueId - Sleeper league ID
 * @param week - Week number (1-18 for regular season)
 * @param options - Optional fetch configuration
 * @returns Array of SleeperMatchup objects or empty array on error
 */
export async function fetchSleeperMatchups(
  leagueId: string,
  week: number,
  options: FetchOptions = {}
): Promise<SleeperMatchup[]> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Validate league ID
  if (!leagueId || typeof leagueId !== 'string' || leagueId.trim() === '') {
    console.error('[fetchSleeperMatchups] Invalid league ID provided');
    return [];
  }

  // Validate week number
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    console.error('[fetchSleeperMatchups] Invalid week number provided (must be 1-18)');
    return [];
  }

  const normalizedLeagueId = leagueId.trim();

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedLeagueId, week);
    if (cached) {
      return cached;
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/league/${normalizedLeagueId}/matchups/${week}`;
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
            `[fetchSleeperMatchups] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
        console.error('[fetchSleeperMatchups] Rate limited after max retries');
        return [];
      }

      // Handle other non-OK responses
      if (!response.ok) {
        console.error(`[fetchSleeperMatchups] API error: ${response.status} ${response.statusText}`);
        return [];
      }

      // Parse and validate response
      const data = await response.json();

      // Validate that we received an array
      if (!Array.isArray(data)) {
        console.error('[fetchSleeperMatchups] Invalid response structure - expected array');
        return [];
      }

      // Type-safe cast with validation
      const matchups = data as SleeperMatchup[];

      // Validate matchup objects have required fields
      const validMatchups = matchups.filter((matchup) => {
        return (
          matchup &&
          typeof matchup === 'object' &&
          typeof matchup.roster_id === 'number' &&
          typeof matchup.points === 'number'
        );
      });

      if (validMatchups.length !== matchups.length) {
        console.warn(
          `[fetchSleeperMatchups] Filtered ${matchups.length - validMatchups.length} invalid matchup objects`
        );
      }

      // Cache the successful response
      setInCache(normalizedLeagueId, week, validMatchups);

      return validMatchups;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        console.error(`[fetchSleeperMatchups] Request timeout for league ${normalizedLeagueId} week ${week}`);
        return [];
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[fetchSleeperMatchups] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}, retrying in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(
    `[fetchSleeperMatchups] Failed to fetch matchups for league ${normalizedLeagueId} week ${week} after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message
  );
  return [];
}

/**
 * Fetch matchups with detailed result including error information
 *
 * @param leagueId - Sleeper league ID
 * @param week - Week number (1-18 for regular season)
 * @param options - Optional fetch configuration
 * @returns Result object with success status and data or error details
 */
export async function fetchSleeperMatchupsWithResult(
  leagueId: string,
  week: number,
  options: FetchOptions = {}
): Promise<FetchSleeperMatchupsResult> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Validate league ID
  if (!leagueId || typeof leagueId !== 'string' || leagueId.trim() === '') {
    return {
      success: false,
      error: 'Invalid league ID provided',
      code: 'API_ERROR',
    };
  }

  // Validate week number
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    return {
      success: false,
      error: 'Invalid week number (must be 1-18)',
      code: 'INVALID_WEEK',
    };
  }

  const normalizedLeagueId = leagueId.trim();

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedLeagueId, week);
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
      const url = `${SLEEPER_API_BASE}/league/${normalizedLeagueId}/matchups/${week}`;
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

      const matchups = data as SleeperMatchup[];

      // Validate matchup objects have required fields
      const validMatchups = matchups.filter((matchup) => {
        return (
          matchup &&
          typeof matchup === 'object' &&
          typeof matchup.roster_id === 'number' &&
          typeof matchup.points === 'number'
        );
      });

      setInCache(normalizedLeagueId, week, validMatchups);

      return {
        success: true,
        data: validMatchups,
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
// Utility Functions
// ============================================================================

/**
 * Pair up matchups by matchup_id
 *
 * @param matchups - Array of SleeperMatchup objects
 * @returns Array of MatchupPair objects
 */
export function pairMatchups(matchups: SleeperMatchup[]): MatchupPair[] {
  const matchupMap = new Map<number, SleeperMatchup[]>();

  // Group matchups by matchup_id
  for (const matchup of matchups) {
    if (matchup.matchup_id === null) {
      // Bye week - skip
      continue;
    }

    const existing = matchupMap.get(matchup.matchup_id) || [];
    existing.push(matchup);
    matchupMap.set(matchup.matchup_id, existing);
  }

  const pairs: MatchupPair[] = [];

  matchupMap.forEach((teams, matchupId) => {
    if (teams.length === 2) {
      const team1 = teams[0];
      const team2 = teams[1];
      if (team1 && team2) {
        const winner = determineWinner(team1, team2);
        const isTie = team1.points === team2.points;

        pairs.push({
          matchupId,
          team1,
          team2,
          winner,
          isTie,
        });
      }
    } else {
      console.warn(`[pairMatchups] Unexpected number of teams for matchup ${matchupId}: ${teams.length}`);
    }
  });

  // Sort by matchup ID
  return pairs.sort((a, b) => a.matchupId - b.matchupId);
}

/**
 * Determine winner between two teams
 *
 * @param team1 - First team's matchup data
 * @param team2 - Second team's matchup data
 * @returns roster_id of winner, or null if tie
 */
export function determineWinner(team1: SleeperMatchup, team2: SleeperMatchup): number | null {
  // Use custom_points if set, otherwise use points
  const team1Points = team1.custom_points ?? team1.points;
  const team2Points = team2.custom_points ?? team2.points;

  if (team1Points > team2Points) {
    return team1.roster_id;
  } else if (team2Points > team1Points) {
    return team2.roster_id;
  }
  return null; // Tie
}

/**
 * Check if a matchup week is complete based on current NFL week
 *
 * @param matchupWeek - The week to check
 * @param currentNFLWeek - The current NFL week
 * @returns true if the matchup week is complete
 */
export function isWeekComplete(matchupWeek: number, currentNFLWeek: number): boolean {
  return matchupWeek < currentNFLWeek;
}

/**
 * Get teams on bye week (those with null matchup_id)
 *
 * @param matchups - Array of SleeperMatchup objects
 * @returns Array of roster_ids on bye
 */
export function getByeWeekTeams(matchups: SleeperMatchup[]): number[] {
  return matchups
    .filter((matchup) => matchup.matchup_id === null)
    .map((matchup) => matchup.roster_id);
}

/**
 * Get roster's points for a given week
 *
 * @param matchups - Array of SleeperMatchup objects
 * @param rosterId - Roster ID to find
 * @returns Points scored or null if roster not found
 */
export function getRosterPoints(matchups: SleeperMatchup[], rosterId: number): number | null {
  const matchup = matchups.find((m) => m.roster_id === rosterId);
  return matchup ? matchup.points : null;
}

/**
 * Map roster IDs to their matchup data for quick lookup
 *
 * @param matchups - Array of SleeperMatchup objects
 * @returns Map of roster_id to SleeperMatchup
 */
export function mapRosterIdsToMatchups(matchups: SleeperMatchup[]): Map<number, SleeperMatchup> {
  const map = new Map<number, SleeperMatchup>();
  for (const matchup of matchups) {
    map.set(matchup.roster_id, matchup);
  }
  return map;
}

// ============================================================================
// Exports
// ============================================================================

export { MATCHUPS_CACHE_TTL_MS };
