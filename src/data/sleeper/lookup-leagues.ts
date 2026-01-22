/**
 * Data layer for Sleeper API league lookups (task-64)
 *
 * This module provides a high-level interface for looking up Sleeper users
 * and their leagues. It delegates to the integrations layer for actual API calls
 * with built-in caching, retry logic, and error handling.
 */

import {
  fetchSleeperLeaguesForMultipleSeasons,
  fetchSleeperLeaguesForUser,
  fetchSleeperLeaguesForUserWithResult,
  getAvatarUrl,
  getCurrentSeason,
  getLeagueType,
} from '@/integrations/sleeper/fetch-leagues-for-user';
import {
  fetchSleeperUser,
  fetchSleeperUserWithResult,
  validateSleeperUsername as validateUsername,
} from '@/integrations/sleeper/fetch-user';

import type { LookupLeaguesError, LookupLeaguesResponse, SleeperLeague, SleeperUser } from '@/types/sleeper';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface LookupLeaguesInput {
  username: string;
  /** Optional season to fetch (defaults to current season) */
  season?: string;
}

export interface LookupLeaguesResult {
  user: SleeperUser | null;
  leagues: SleeperLeague[];
}

/** Extended lookup result with metadata for UI display */
export interface LookupLeaguesDetailedResult {
  success: boolean;
  user: SleeperUser | null;
  leagues: SleeperLeague[];
  count: number;
  season: string;
  message?: string;
  error?: LookupLeaguesError;
}

/** League selection card data for the wizard UI */
export interface LeagueSelectionCard {
  id: string;
  name: string;
  teamCount: number;
  status: string;
  type: 'Redraft' | 'Keeper' | 'Dynasty' | 'Unknown';
  avatar: string;
  season: string;
}

// ============================================================================
// Re-exports
// ============================================================================

// Re-export validation function for consumers
export { validateUsername as validateSleeperUsername };

// Re-export helper functions
export { getLeagueType, getAvatarUrl, getCurrentSeason };

// Re-export integration functions for direct use if needed
export { fetchSleeperLeaguesForUser, fetchSleeperLeaguesForUserWithResult, fetchSleeperLeaguesForMultipleSeasons };

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Look up a Sleeper user by username
 * Fetches from Sleeper API with caching (1 hour TTL)
 */
export async function lookupSleeperUser(username: string): Promise<SleeperUser | null> {
  return fetchSleeperUser(username);
}

/**
 * Look up a Sleeper user with detailed result
 * Provides error codes for different failure scenarios
 */
export async function lookupSleeperUserWithResult(username: string) {
  return fetchSleeperUserWithResult(username);
}

/**
 * Look up leagues for a Sleeper user
 * First fetches user, then fetches their leagues for the specified season
 *
 * Uses the integration layer with:
 * - 1-hour cache TTL for user data
 * - 15-minute cache TTL for leagues data
 * - Retry logic with exponential backoff
 */
export async function lookupLeaguesByUsername(input: LookupLeaguesInput): Promise<LookupLeaguesResult> {
  const { username, season } = input;

  // Look up user first
  const user = await lookupSleeperUser(username);

  if (!user) {
    return { user: null, leagues: [] };
  }

  // Fetch user's leagues for the specified season (defaults to current)
  const leagues = await fetchSleeperLeaguesForUser(user.user_id, {
    season: season || getCurrentSeason(),
  });

  return { user, leagues };
}

/**
 * Look up leagues for a Sleeper user with detailed result
 * Returns LookupLeaguesResponse type per the type contract
 */
export async function lookupLeaguesByUsernameDetailed(input: LookupLeaguesInput): Promise<LookupLeaguesDetailedResult> {
  const { username, season: inputSeason } = input;
  const season = inputSeason || getCurrentSeason();

  // Validate username first
  const validationError = validateUsername(username);
  if (validationError) {
    return {
      success: false,
      user: null,
      leagues: [],
      count: 0,
      season,
      message: validationError,
      error: {
        error: validationError,
        code: 'INVALID_USERNAME',
      },
    };
  }

  // Look up user first
  const userResult = await fetchSleeperUserWithResult(username);

  if (!userResult.success) {
    return {
      success: false,
      user: null,
      leagues: [],
      count: 0,
      season,
      message: userResult.error,
      error: {
        error: userResult.error,
        code: userResult.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'UNKNOWN',
      },
    };
  }

  // Fetch user's leagues
  const leaguesResult = await fetchSleeperLeaguesForUserWithResult(userResult.data.user_id, {
    season,
  });

  if (!leaguesResult.success) {
    return {
      success: false,
      user: userResult.data,
      leagues: [],
      count: 0,
      season,
      message: leaguesResult.error,
      error: {
        error: leaguesResult.error,
        code: leaguesResult.code === 'TIMEOUT' ? 'TIMEOUT' : 'UNKNOWN',
      },
    };
  }

  const leagues = leaguesResult.data;
  const message = leagues.length === 0 ? 'No leagues found for this user' : undefined;

  return {
    success: true,
    user: userResult.data,
    leagues,
    count: leagues.length,
    season,
    message,
  };
}

/**
 * Get leagues formatted as LookupLeaguesResponse (type contract)
 * This is the primary function for the frontend wizard
 */
export async function getLookupLeaguesResponse(username: string, season?: string): Promise<LookupLeaguesResponse> {
  const result = await lookupLeaguesByUsername({ username, season });
  return {
    leagues: result.leagues,
  };
}

/**
 * Transform leagues into selection cards for the wizard UI
 * Converts raw Sleeper API data into the format expected by the frontend
 */
export function transformToSelectionCards(leagues: SleeperLeague[]): LeagueSelectionCard[] {
  return leagues.map((league) => {
    const typeNum = league.settings?.type;
    const leagueType = getLeagueType(typeNum);
    const typeDisplay =
      leagueType === 'redraft'
        ? 'Redraft'
        : leagueType === 'keeper'
          ? 'Keeper'
          : leagueType === 'dynasty'
            ? 'Dynasty'
            : 'Unknown';

    return {
      id: league.league_id,
      name: league.name,
      teamCount: league.total_rosters,
      status: league.status,
      type: typeDisplay,
      avatar: getAvatarUrl(league.avatar),
      season: league.season,
    };
  });
}

/**
 * Fetch leagues and return as selection cards
 * Convenience function for the wizard step 2 UI
 */
export async function getLeagueSelectionCards(
  username: string,
  season?: string
): Promise<{ cards: LeagueSelectionCard[]; user: SleeperUser | null; error?: string }> {
  const result = await lookupLeaguesByUsernameDetailed({ username, season });

  if (!result.success) {
    return {
      cards: [],
      user: null,
      error: result.message || 'Failed to fetch leagues',
    };
  }

  return {
    cards: transformToSelectionCards(result.leagues),
    user: result.user,
  };
}

/**
 * Fetch leagues for multiple seasons
 * Useful for showing historical league data
 */
export async function lookupLeaguesMultipleSeasons(
  username: string,
  seasons: string[]
): Promise<{ user: SleeperUser | null; leaguesBySeason: Record<string, SleeperLeague[]> }> {
  // Look up user first
  const user = await lookupSleeperUser(username);

  if (!user) {
    return { user: null, leaguesBySeason: {} };
  }

  // Fetch leagues for all seasons
  const leaguesBySeason = await fetchSleeperLeaguesForMultipleSeasons(user.user_id, seasons);

  return { user, leaguesBySeason };
}
