/**
 * Sleeper Players Integration Function (task-59)
 *
 * Fetches the complete NFL player database from Sleeper API with:
 * - Exponential backoff retry logic for rate limiting
 * - In-memory caching with 24-hour TTL (daily updates per PRD)
 * - Type-safe response handling
 * - Player lookup map by ID for efficient access
 */

import { MAX_RETRIES, SLEEPER_API_BASE } from './fetch-league';

import type { SleeperPlayer, SleeperPlayersResponse } from '@/types/sleeper';

// ============================================================================
// Configuration
// ============================================================================

/** Cache TTL in milliseconds (24 hours per PRD - updates daily max) */
const PLAYERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours = 86400000ms

/** Base delay for exponential backoff (in ms) */
const BASE_DELAY_MS = 100;

/** Request timeout (30 seconds - larger due to ~5MB response) */
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================================
// Types
// ============================================================================

interface CacheEntry {
  data: SleeperPlayersResponse;
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
  data: SleeperPlayersResponse;
  fromCache: boolean;
  playerCount: number;
}

interface FetchError {
  success: false;
  error: string;
  code: 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR' | 'PARSE_ERROR';
}

export type FetchSleeperPlayersResult = FetchResult | FetchError;

// ============================================================================
// In-Memory Cache
// ============================================================================

/**
 * In-memory cache for player database
 * Uses a single entry since there's only one global player database
 */
let playersCache: CacheEntry | null = null;

/**
 * Get cache key for players (sport-based)
 */
function getCacheKey(sport = 'nfl'): string {
  return `sleeper:players:${sport}`;
}

/**
 * Get cached players data if available and not expired
 */
function getFromCache(): SleeperPlayersResponse | null {
  if (!playersCache) {
    return null;
  }

  const now = Date.now();
  if (now >= playersCache.expiresAt) {
    // Cache entry has expired, remove it
    playersCache = null;
    return null;
  }

  return playersCache.data;
}

/**
 * Store players data in cache
 */
function setInCache(data: SleeperPlayersResponse): void {
  const now = Date.now();

  playersCache = {
    data,
    fetchedAt: now,
    expiresAt: now + PLAYERS_CACHE_TTL_MS,
  };
}

/**
 * Invalidate players cache
 */
export function invalidatePlayersCache(): void {
  playersCache = null;
}

/**
 * Clear players cache (alias for invalidatePlayersCache)
 */
export function clearPlayersCache(): void {
  playersCache = null;
}

/**
 * Get cache statistics for monitoring
 */
export function getPlayersCacheStats(): {
  isCached: boolean;
  expiresAt: number | null;
  fetchedAt: number | null;
  playerCount: number | null;
  timeUntilExpiry: number | null;
} {
  if (!playersCache) {
    return {
      isCached: false,
      expiresAt: null,
      fetchedAt: null,
      playerCount: null,
      timeUntilExpiry: null,
    };
  }

  const now = Date.now();
  return {
    isCached: true,
    expiresAt: playersCache.expiresAt,
    fetchedAt: playersCache.fetchedAt,
    playerCount: Object.keys(playersCache.data).length,
    timeUntilExpiry: Math.max(0, playersCache.expiresAt - now),
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
// Validation
// ============================================================================

/**
 * Validate that a player object has the required fields
 */
function isValidPlayer(player: unknown): player is SleeperPlayer {
  if (!player || typeof player !== 'object') {
    return false;
  }

  const p = player as Record<string, unknown>;
  return (
    typeof p.player_id === 'string' &&
    p.player_id.length > 0 &&
    (typeof p.full_name === 'string' || p.full_name === null || p.full_name === undefined) &&
    (typeof p.position === 'string' || p.position === null || p.position === undefined)
  );
}

// ============================================================================
// Main Fetch Function
// ============================================================================

/**
 * Fetch complete NFL player database from Sleeper API
 *
 * Features:
 * - Exponential backoff retry on rate limits (429) and network errors
 * - In-memory caching with 24-hour TTL (updates daily per PRD)
 * - Timeout handling (30 second default for large ~5MB response)
 * - Returns null on critical errors
 *
 * @param options - Optional fetch configuration
 * @returns SleeperPlayersResponse (player_id -> SleeperPlayer map) or null on error
 */
export async function fetchSleeperPlayers(options: FetchOptions = {}): Promise<SleeperPlayersResponse | null> {
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
      const url = `${SLEEPER_API_BASE}/players/nfl`;
      const response = await fetchWithTimeout(url, timeout);

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          console.warn(
            `[fetchSleeperPlayers] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
        console.error('[fetchSleeperPlayers] Rate limited after max retries');
        return null;
      }

      // Handle other non-OK responses
      if (!response.ok) {
        console.error(`[fetchSleeperPlayers] API error: ${response.status} ${response.statusText}`);
        return null;
      }

      // Parse and validate response
      const data = await response.json();

      // Validate that we received an object (player_id -> player map)
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        console.error('[fetchSleeperPlayers] Invalid response structure - expected object');
        return null;
      }

      // Type-safe cast
      const players = data as SleeperPlayersResponse;

      // Cache the successful response
      setInCache(players);

      return players;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        console.error('[fetchSleeperPlayers] Request timeout');
        return null;
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[fetchSleeperPlayers] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}, retrying in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(`[fetchSleeperPlayers] Failed to fetch players after ${MAX_RETRIES + 1} attempts:`, lastError?.message);
  return null;
}

/**
 * Fetch players with detailed result including error information
 *
 * @param options - Optional fetch configuration
 * @returns Result object with success status and data or error details
 */
export async function fetchSleeperPlayersWithResult(options: FetchOptions = {}): Promise<FetchSleeperPlayersResult> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS } = options;

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache();
    if (cached) {
      return {
        success: true,
        data: cached,
        fromCache: true,
        playerCount: Object.keys(cached).length,
      };
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;
  let rateLimited = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/players/nfl`;
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
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        return {
          success: false,
          error: 'Failed to parse JSON response',
          code: 'PARSE_ERROR',
        };
      }

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {
          success: false,
          error: 'Invalid response structure from Sleeper API - expected object',
          code: 'API_ERROR',
        };
      }

      const players = data as SleeperPlayersResponse;
      setInCache(players);

      return {
        success: true,
        data: players,
        fromCache: false,
        playerCount: Object.keys(players).length,
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
 * Create a player lookup Map from the players response
 * More efficient for repeated lookups than object property access
 *
 * @param players - SleeperPlayersResponse object
 * @returns Map of player_id to SleeperPlayer
 */
export function createPlayerLookupMap(players: SleeperPlayersResponse): Map<string, SleeperPlayer> {
  return new Map(Object.entries(players));
}

/**
 * Get a player by ID from the player database
 *
 * @param players - SleeperPlayersResponse object or Map
 * @param playerId - Player ID to lookup
 * @returns SleeperPlayer or undefined if not found
 */
export function getPlayerById(
  players: SleeperPlayersResponse | Map<string, SleeperPlayer>,
  playerId: string
): SleeperPlayer | undefined {
  if (players instanceof Map) {
    return players.get(playerId);
  }
  return players[playerId];
}

/**
 * Filter players by position
 *
 * @param players - SleeperPlayersResponse object
 * @param position - Position to filter by (QB, RB, WR, TE, K, DEF)
 * @returns Array of matching players
 */
export function filterPlayersByPosition(players: SleeperPlayersResponse, position: string): SleeperPlayer[] {
  return Object.values(players).filter((player) => player.position === position);
}

/**
 * Filter players by team
 *
 * @param players - SleeperPlayersResponse object
 * @param team - Team abbreviation to filter by (KC, SF, etc.)
 * @returns Array of matching players
 */
export function filterPlayersByTeam(players: SleeperPlayersResponse, team: string): SleeperPlayer[] {
  return Object.values(players).filter((player) => player.team === team);
}

/**
 * Filter players by status
 *
 * @param players - SleeperPlayersResponse object
 * @param status - Status to filter by (Active, Inactive, Injured Reserve, etc.)
 * @returns Array of matching players
 */
export function filterPlayersByStatus(players: SleeperPlayersResponse, status: string): SleeperPlayer[] {
  return Object.values(players).filter((player) => player.status === status);
}

/**
 * Get active players only
 *
 * @param players - SleeperPlayersResponse object
 * @returns Array of active players
 */
export function getActivePlayers(players: SleeperPlayersResponse): SleeperPlayer[] {
  return Object.values(players).filter((player) => player.status === 'Active');
}

/**
 * Get players with injuries
 *
 * @param players - SleeperPlayersResponse object
 * @returns Array of injured players (with non-null injury_status)
 */
export function getInjuredPlayers(players: SleeperPlayersResponse): SleeperPlayer[] {
  return Object.values(players).filter((player) => player.injury_status !== null && player.injury_status !== undefined);
}

/**
 * Search players by name (case-insensitive partial match)
 *
 * @param players - SleeperPlayersResponse object
 * @param query - Search query string
 * @returns Array of matching players
 */
export function searchPlayersByName(players: SleeperPlayersResponse, query: string): SleeperPlayer[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(players).filter((player) => {
    const fullName = player.full_name?.toLowerCase() || '';
    const searchName = player.search_full_name?.toLowerCase() || '';
    return fullName.includes(lowerQuery) || searchName.includes(lowerQuery);
  });
}

/**
 * Get player count by position
 *
 * @param players - SleeperPlayersResponse object
 * @returns Map of position to player count
 */
export function getPlayerCountByPosition(players: SleeperPlayersResponse): Map<string, number> {
  const counts = new Map<string, number>();

  for (const player of Object.values(players)) {
    if (player.position) {
      const current = counts.get(player.position) || 0;
      counts.set(player.position, current + 1);
    }
  }

  return counts;
}

/**
 * Get player count by team
 *
 * @param players - SleeperPlayersResponse object
 * @returns Map of team to player count
 */
export function getPlayerCountByTeam(players: SleeperPlayersResponse): Map<string, number> {
  const counts = new Map<string, number>();

  for (const player of Object.values(players)) {
    if (player.team) {
      const current = counts.get(player.team) || 0;
      counts.set(player.team, current + 1);
    }
  }

  return counts;
}

// ============================================================================
// Exports
// ============================================================================

export { PLAYERS_CACHE_TTL_MS };
