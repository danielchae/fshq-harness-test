/**
 * Sleeper Transactions Integration Function (task-58)
 *
 * Fetches transaction history from the Sleeper API with:
 * - Exponential backoff retry logic for rate limiting
 * - In-memory caching with 15-minute TTL
 * - Type-safe response handling
 * - Filtering by transaction type (trade, add, drop, waiver)
 */

import { MAX_RETRIES, SLEEPER_API_BASE } from './fetch-league';

import type { SleeperTransaction, SleeperTransactionStatus, SleeperTransactionType } from '@/types/sleeper';

// ============================================================================
// Configuration
// ============================================================================

/** Cache TTL in milliseconds (15 minutes per PRD) */
const TRANSACTIONS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes = 900000ms

/** Base delay for exponential backoff (in ms) */
const BASE_DELAY_MS = 100;

/** Request timeout (10 seconds) */
const REQUEST_TIMEOUT_MS = 10000;

// ============================================================================
// Types
// ============================================================================

interface CacheEntry {
  data: SleeperTransaction[];
  expiresAt: number;
  fetchedAt: number;
}

interface FetchOptions {
  /** Skip cache and force fetch from API */
  skipCache?: boolean;
  /** Custom timeout in milliseconds */
  timeout?: number;
  /** Filter by transaction types */
  types?: SleeperTransactionType[];
  /** Filter by transaction status */
  status?: SleeperTransactionStatus;
}

interface FetchResult {
  success: true;
  data: SleeperTransaction[];
  fromCache: boolean;
}

interface FetchError {
  success: false;
  error: string;
  code: 'NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR' | 'INVALID_WEEK';
}

export type FetchSleeperTransactionsResult = FetchResult | FetchError;

// ============================================================================
// In-Memory Cache
// ============================================================================

/**
 * In-memory cache for transaction data
 * Uses Map for O(1) lookup performance
 */
const transactionsCache = new Map<string, CacheEntry>();

/**
 * Generate cache key for transactions (keyed by league + week)
 */
function getCacheKey(leagueId: string, week: number): string {
  return `sleeper:transactions:${leagueId}:${week}`;
}

/**
 * Get cached transactions data if available and not expired
 */
function getFromCache(leagueId: string, week: number): SleeperTransaction[] | null {
  const key = getCacheKey(leagueId, week);
  const entry = transactionsCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    // Cache entry has expired, remove it
    transactionsCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store transactions data in cache
 */
function setInCache(leagueId: string, week: number, data: SleeperTransaction[]): void {
  const key = getCacheKey(leagueId, week);
  const now = Date.now();

  transactionsCache.set(key, {
    data,
    fetchedAt: now,
    expiresAt: now + TRANSACTIONS_CACHE_TTL_MS,
  });
}

/**
 * Invalidate cache entry for transactions
 */
export function invalidateTransactionsCache(leagueId: string, week: number): void {
  const key = getCacheKey(leagueId, week);
  transactionsCache.delete(key);
}

/**
 * Invalidate all transaction cache entries for a league
 */
export function invalidateLeagueTransactionsCache(leagueId: string): void {
  const keysToDelete: string[] = [];

  transactionsCache.forEach((_, key) => {
    if (key.startsWith(`sleeper:transactions:${leagueId}:`)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => transactionsCache.delete(key));
}

/**
 * Clear all cached transactions data
 */
export function clearTransactionsCache(): void {
  transactionsCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getTransactionsCacheStats(): {
  size: number;
  entries: { leagueId: string; week: number; expiresAt: number; fetchedAt: number }[];
} {
  const entries: { leagueId: string; week: number; expiresAt: number; fetchedAt: number }[] = [];

  transactionsCache.forEach((entry, key) => {
    // Parse key: sleeper:transactions:{leagueId}:{week}
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
    size: transactionsCache.size,
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
 * Fetch transactions for a specific week from Sleeper API
 *
 * Features:
 * - Exponential backoff retry on rate limits (429) and network errors
 * - In-memory caching with 15-minute TTL
 * - Timeout handling (10 second default)
 * - Optional filtering by transaction type and status
 * - Returns empty array for 404 (league not found)
 *
 * @param leagueId - Sleeper league ID
 * @param week - Week number (1-18 for regular season)
 * @param options - Optional fetch configuration
 * @returns Array of SleeperTransaction objects or empty array on error
 */
export async function fetchSleeperTransactions(
  leagueId: string,
  week: number,
  options: FetchOptions = {}
): Promise<SleeperTransaction[]> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS, types, status } = options;

  // Validate league ID
  if (!leagueId || typeof leagueId !== 'string' || leagueId.trim() === '') {
    console.error('[fetchSleeperTransactions] Invalid league ID provided');
    return [];
  }

  // Validate week number
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    console.error('[fetchSleeperTransactions] Invalid week number provided (must be 1-18)');
    return [];
  }

  const normalizedLeagueId = leagueId.trim();

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(normalizedLeagueId, week);
    if (cached) {
      // Apply filters to cached data
      return filterTransactions(cached, types, status);
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/league/${normalizedLeagueId}/transactions/${week}`;
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
            `[fetchSleeperTransactions] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
        console.error('[fetchSleeperTransactions] Rate limited after max retries');
        return [];
      }

      // Handle other non-OK responses
      if (!response.ok) {
        console.error(`[fetchSleeperTransactions] API error: ${response.status} ${response.statusText}`);
        return [];
      }

      // Parse and validate response
      const data = await response.json();

      // Validate that we received an array
      if (!Array.isArray(data)) {
        console.error('[fetchSleeperTransactions] Invalid response structure - expected array');
        return [];
      }

      // Type-safe cast with validation
      const transactions = data as SleeperTransaction[];

      // Validate transaction objects have required fields
      const validTransactions = transactions.filter((transaction) => {
        return (
          transaction &&
          typeof transaction === 'object' &&
          typeof transaction.transaction_id === 'string' &&
          typeof transaction.type === 'string' &&
          typeof transaction.status === 'string' &&
          Array.isArray(transaction.roster_ids) &&
          typeof transaction.created === 'number'
        );
      });

      if (validTransactions.length !== transactions.length) {
        console.warn(
          `[fetchSleeperTransactions] Filtered ${transactions.length - validTransactions.length} invalid transaction objects`
        );
      }

      // Cache the successful response (unfiltered)
      setInCache(normalizedLeagueId, week, validTransactions);

      // Return filtered transactions if filters specified
      return filterTransactions(validTransactions, types, status);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout)
      if (lastError.name === 'AbortError') {
        console.error(`[fetchSleeperTransactions] Request timeout for league ${normalizedLeagueId} week ${week}`);
        return [];
      }

      // Handle network errors with retry
      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[fetchSleeperTransactions] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}, retrying in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(
    `[fetchSleeperTransactions] Failed to fetch transactions for league ${normalizedLeagueId} week ${week} after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message
  );
  return [];
}

/**
 * Fetch transactions with detailed result including error information
 *
 * @param leagueId - Sleeper league ID
 * @param week - Week number (1-18 for regular season)
 * @param options - Optional fetch configuration
 * @returns Result object with success status and data or error details
 */
export async function fetchSleeperTransactionsWithResult(
  leagueId: string,
  week: number,
  options: FetchOptions = {}
): Promise<FetchSleeperTransactionsResult> {
  const { skipCache = false, timeout = REQUEST_TIMEOUT_MS, types, status } = options;

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
        data: filterTransactions(cached, types, status),
        fromCache: true,
      };
    }
  }

  // Attempt to fetch from API with retries
  let lastError: Error | null = null;
  let rateLimited = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${SLEEPER_API_BASE}/league/${normalizedLeagueId}/transactions/${week}`;
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

      const transactions = data as SleeperTransaction[];

      // Validate transaction objects have required fields
      const validTransactions = transactions.filter((transaction) => {
        return (
          transaction &&
          typeof transaction === 'object' &&
          typeof transaction.transaction_id === 'string' &&
          typeof transaction.type === 'string' &&
          typeof transaction.status === 'string' &&
          Array.isArray(transaction.roster_ids) &&
          typeof transaction.created === 'number'
        );
      });

      setInCache(normalizedLeagueId, week, validTransactions);

      return {
        success: true,
        data: filterTransactions(validTransactions, types, status),
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
 * Filter transactions by type and/or status
 *
 * @param transactions - Array of transactions to filter
 * @param types - Optional array of transaction types to include
 * @param status - Optional status to filter by
 * @returns Filtered array of transactions
 */
export function filterTransactions(
  transactions: SleeperTransaction[],
  types?: SleeperTransactionType[],
  status?: SleeperTransactionStatus
): SleeperTransaction[] {
  let filtered = transactions;

  if (types && types.length > 0) {
    filtered = filtered.filter((t) => types.includes(t.type));
  }

  if (status) {
    filtered = filtered.filter((t) => t.status === status);
  }

  return filtered;
}

/**
 * Get only trade transactions
 *
 * @param transactions - Array of transactions
 * @returns Array of trade transactions
 */
export function getTradeTransactions(transactions: SleeperTransaction[]): SleeperTransaction[] {
  return transactions.filter((t) => t.type === 'trade');
}

/**
 * Get only waiver transactions
 *
 * @param transactions - Array of transactions
 * @returns Array of waiver transactions
 */
export function getWaiverTransactions(transactions: SleeperTransaction[]): SleeperTransaction[] {
  return transactions.filter((t) => t.type === 'waiver');
}

/**
 * Get only free agent transactions
 *
 * @param transactions - Array of transactions
 * @returns Array of free agent transactions
 */
export function getFreeAgentTransactions(transactions: SleeperTransaction[]): SleeperTransaction[] {
  return transactions.filter((t) => t.type === 'free_agent');
}

/**
 * Get transactions involving a specific roster
 *
 * @param transactions - Array of transactions
 * @param rosterId - Roster ID to filter by
 * @returns Array of transactions involving the roster
 */
export function getTransactionsByRoster(transactions: SleeperTransaction[], rosterId: number): SleeperTransaction[] {
  return transactions.filter((t) => t.roster_ids.includes(rosterId));
}

/**
 * Get transactions involving a specific player
 *
 * @param transactions - Array of transactions
 * @param playerId - Player ID to search for
 * @returns Array of transactions involving the player
 */
export function getTransactionsByPlayer(transactions: SleeperTransaction[], playerId: string): SleeperTransaction[] {
  return transactions.filter((t) => {
    const inAdds = t.adds && playerId in t.adds;
    const inDrops = t.drops && playerId in t.drops;
    return inAdds || inDrops;
  });
}

/**
 * Get pending transactions
 *
 * @param transactions - Array of transactions
 * @returns Array of pending transactions
 */
export function getPendingTransactions(transactions: SleeperTransaction[]): SleeperTransaction[] {
  return transactions.filter((t) => t.status === 'pending');
}

/**
 * Get completed transactions
 *
 * @param transactions - Array of transactions
 * @returns Array of completed transactions
 */
export function getCompletedTransactions(transactions: SleeperTransaction[]): SleeperTransaction[] {
  return transactions.filter((t) => t.status === 'complete');
}

/**
 * Sort transactions by creation time
 *
 * @param transactions - Array of transactions
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted array of transactions
 */
export function sortTransactionsByTime(
  transactions: SleeperTransaction[],
  order: 'asc' | 'desc' = 'desc'
): SleeperTransaction[] {
  return [...transactions].sort((a, b) => {
    return order === 'desc' ? b.created - a.created : a.created - b.created;
  });
}

/**
 * Get all players added in transactions
 *
 * @param transactions - Array of transactions
 * @returns Map of player_id to roster_id that received them
 */
export function getAllPlayersAdded(transactions: SleeperTransaction[]): Map<string, number[]> {
  const playersMap = new Map<string, number[]>();

  for (const transaction of transactions) {
    if (transaction.adds) {
      for (const [playerId, rosterId] of Object.entries(transaction.adds)) {
        const existing = playersMap.get(playerId) || [];
        existing.push(rosterId);
        playersMap.set(playerId, existing);
      }
    }
  }

  return playersMap;
}

/**
 * Get all players dropped in transactions
 *
 * @param transactions - Array of transactions
 * @returns Map of player_id to roster_id that dropped them
 */
export function getAllPlayersDropped(transactions: SleeperTransaction[]): Map<string, number[]> {
  const playersMap = new Map<string, number[]>();

  for (const transaction of transactions) {
    if (transaction.drops) {
      for (const [playerId, rosterId] of Object.entries(transaction.drops)) {
        const existing = playersMap.get(playerId) || [];
        existing.push(rosterId);
        playersMap.set(playerId, existing);
      }
    }
  }

  return playersMap;
}

/**
 * Map transaction IDs to their data for quick lookup
 *
 * @param transactions - Array of SleeperTransaction objects
 * @returns Map of transaction_id to SleeperTransaction
 */
export function mapTransactionIdsToData(transactions: SleeperTransaction[]): Map<string, SleeperTransaction> {
  const map = new Map<string, SleeperTransaction>();
  for (const transaction of transactions) {
    map.set(transaction.transaction_id, transaction);
  }
  return map;
}

// ============================================================================
// Exports
// ============================================================================

export { TRANSACTIONS_CACHE_TTL_MS };
