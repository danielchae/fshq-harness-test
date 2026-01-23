/**
 * Sleeper League History Fetcher
 *
 * Fetches all previous seasons for a league by chaining previous_league_id calls.
 * Sleeper's API returns a previous_league_id on each league object, which points
 * to the previous season's league. This function follows that chain to build
 * complete league history.
 *
 * @module src/integrations/sleeper/fetch-league-history
 */

import type { SleeperLeague, SleeperRoster } from '@/types/sleeper';

// ============================================================================
// Configuration
// ============================================================================

/** Sleeper API base URL (public, no auth required) */
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

/** Maximum number of seasons to fetch (prevent infinite loops) */
const MAX_SEASONS = 20;

/** Request timeout (10 seconds) */
const REQUEST_TIMEOUT_MS = 10000;

/** Delay between API calls to respect rate limits (ms) */
const API_CALL_DELAY_MS = 100;

// ============================================================================
// Types
// ============================================================================

export interface LeagueHistorySeason {
  leagueId: string;
  name: string;
  season: string;
  year: number;
  totalRosters: number;
  status: string;
  isDynasty: boolean;
  avatarUrl?: string;
  // Roster data for standings
  rosters: SleeperRoster[];
  // Computed standings data
  champion?: {
    name: string;
    rosterId: number;
    ownerId?: string;
    wins: number;
    losses: number;
    pointsFor: number;
  };
  runnerUp?: {
    name: string;
    rosterId: number;
    ownerId?: string;
    wins: number;
    losses: number;
    pointsFor: number;
  };
  thirdPlace?: {
    name: string;
    rosterId: number;
    ownerId?: string;
  };
}

export interface FetchLeagueHistoryResult {
  success: true;
  seasons: LeagueHistorySeason[];
  currentLeagueId: string;
}

export interface FetchLeagueHistoryError {
  success: false;
  error: string;
  code: 'NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'API_ERROR';
}

export type FetchLeagueHistoryResponse = FetchLeagueHistoryResult | FetchLeagueHistoryError;

// ============================================================================
// Helper Functions
// ============================================================================

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

/**
 * Fetch a single league from Sleeper API
 */
async function fetchLeague(leagueId: string): Promise<SleeperLeague | null> {
  try {
    const response = await fetchWithTimeout(`${SLEEPER_API_BASE}/league/${leagueId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.error(`[fetchLeagueHistory] API error fetching league ${leagueId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data as SleeperLeague;
  } catch (error) {
    console.error(`[fetchLeagueHistory] Error fetching league ${leagueId}:`, error);
    return null;
  }
}

/**
 * Fetch rosters for a league
 */
async function fetchRosters(leagueId: string): Promise<SleeperRoster[]> {
  try {
    const response = await fetchWithTimeout(`${SLEEPER_API_BASE}/league/${leagueId}/rosters`);

    if (!response.ok) {
      console.error(`[fetchLeagueHistory] API error fetching rosters for ${leagueId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data as SleeperRoster[];
  } catch (error) {
    console.error(`[fetchLeagueHistory] Error fetching rosters for ${leagueId}:`, error);
    return [];
  }
}

/**
 * Bracket matchup from Sleeper API
 */
interface BracketMatchup {
  /** Matchup number */
  m: number;
  /** Round number */
  r: number;
  /** Winner roster_id */
  w: number;
  /** Loser roster_id */
  l: number;
  /** Team 1 roster_id */
  t1: number;
  /** Team 2 roster_id */
  t2: number;
  /** Placement (1 = championship, 3 = 3rd place, 5 = 5th place, etc.) */
  p?: number;
}

/**
 * Fetch winners bracket for a league
 * Returns playoff bracket data with matchup results
 */
async function fetchWinnersBracket(leagueId: string): Promise<BracketMatchup[]> {
  try {
    const response = await fetchWithTimeout(`${SLEEPER_API_BASE}/league/${leagueId}/winners_bracket`);

    if (!response.ok) {
      console.error(`[fetchLeagueHistory] API error fetching bracket for ${leagueId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data as BracketMatchup[]) || [];
  } catch (error) {
    console.error(`[fetchLeagueHistory] Error fetching bracket for ${leagueId}:`, error);
    return [];
  }
}

/**
 * Fetch league users to get display names
 */
async function fetchLeagueUsers(leagueId: string): Promise<Map<string, string>> {
  try {
    const response = await fetchWithTimeout(`${SLEEPER_API_BASE}/league/${leagueId}/users`);

    if (!response.ok) {
      return new Map();
    }

    const users = await response.json();
    const userMap = new Map<string, string>();

    for (const user of users) {
      if (user.user_id && user.display_name) {
        userMap.set(user.user_id, user.metadata?.team_name || user.display_name);
      }
    }

    return userMap;
  } catch (error) {
    console.error(`[fetchLeagueHistory] Error fetching users for ${leagueId}:`, error);
    return new Map();
  }
}

/**
 * Helper to build roster info object
 */
function buildRosterInfo(
  roster: SleeperRoster,
  getName: (roster: SleeperRoster) => string
): {
  name: string;
  rosterId: number;
  ownerId?: string;
  wins: number;
  losses: number;
  pointsFor: number;
} {
  return {
    name: getName(roster),
    rosterId: roster.roster_id,
    ownerId: roster.owner_id ?? undefined,
    wins: roster.settings?.wins ?? 0,
    losses: roster.settings?.losses ?? 0,
    pointsFor: (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100,
  };
}

/**
 * Determine champion and runner-up from playoff bracket results
 * Falls back to regular season wins if bracket data is unavailable
 *
 * The bracket data contains matchups with:
 * - p: placement (1 = championship, 3 = 3rd place game)
 * - w: winner roster_id
 * - l: loser roster_id
 */
function determineStandings(
  rosters: SleeperRoster[],
  userMap: Map<string, string>,
  bracket: BracketMatchup[]
): {
  champion?: LeagueHistorySeason['champion'];
  runnerUp?: LeagueHistorySeason['runnerUp'];
  thirdPlace?: LeagueHistorySeason['thirdPlace'];
} {
  if (rosters.length === 0) {
    return {};
  }

  const getName = (roster: SleeperRoster): string => {
    if (roster.owner_id && userMap.has(roster.owner_id)) {
      return userMap.get(roster.owner_id)!;
    }
    return `Team ${roster.roster_id}`;
  };

  // Create a map of roster_id to roster for quick lookup
  const rosterMap = new Map<number, SleeperRoster>();
  for (const roster of rosters) {
    rosterMap.set(roster.roster_id, roster);
  }

  // Try to get placements from bracket data
  // p: 1 = championship game, p: 3 = 3rd place game
  const championshipGame = bracket.find((m) => m.p === 1);
  const thirdPlaceGame = bracket.find((m) => m.p === 3);

  if (championshipGame && championshipGame.w && championshipGame.l) {
    // We have bracket data - use actual playoff results
    const championRoster = rosterMap.get(championshipGame.w);
    const runnerUpRoster = rosterMap.get(championshipGame.l);
    const thirdPlaceRoster = thirdPlaceGame?.w ? rosterMap.get(thirdPlaceGame.w) : undefined;

    console.log(
      `[determineStandings] Using bracket data: Champion roster ${championshipGame.w}, Runner-up roster ${championshipGame.l}`
    );

    return {
      champion: championRoster ? buildRosterInfo(championRoster, getName) : undefined,
      runnerUp: runnerUpRoster ? buildRosterInfo(runnerUpRoster, getName) : undefined,
      thirdPlace: thirdPlaceRoster
        ? {
            name: getName(thirdPlaceRoster),
            rosterId: thirdPlaceRoster.roster_id,
            ownerId: thirdPlaceRoster.owner_id ?? undefined,
          }
        : undefined,
    };
  }

  // Fallback: Sort rosters by wins (descending), then by points (descending)
  console.log(`[determineStandings] No bracket data available, falling back to regular season standings`);

  const sortedRosters = [...rosters].sort((a, b) => {
    const winsA = a.settings?.wins ?? 0;
    const winsB = b.settings?.wins ?? 0;

    if (winsB !== winsA) {
      return winsB - winsA;
    }

    // Tie-breaker: points scored
    const ptsA = (a.settings?.fpts ?? 0) + (a.settings?.fpts_decimal ?? 0) / 100;
    const ptsB = (b.settings?.fpts ?? 0) + (b.settings?.fpts_decimal ?? 0) / 100;
    return ptsB - ptsA;
  });

  const champion = sortedRosters[0];
  const runnerUp = sortedRosters[1];
  const thirdPlace = sortedRosters[2];

  return {
    champion: champion ? buildRosterInfo(champion, getName) : undefined,
    runnerUp: runnerUp ? buildRosterInfo(runnerUp, getName) : undefined,
    thirdPlace: thirdPlace
      ? {
          name: getName(thirdPlace),
          rosterId: thirdPlace.roster_id,
          ownerId: thirdPlace.owner_id ?? undefined,
        }
      : undefined,
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Fetch complete league history by following previous_league_id chain
 *
 * This function:
 * 1. Starts with the current league ID
 * 2. Fetches the league data
 * 3. If the league has a previous_league_id, fetches that league
 * 4. Repeats until no more previous leagues exist
 * 5. For each season, fetches rosters to determine standings
 *
 * @param leagueId - Current Sleeper league ID to start from
 * @returns Array of historical seasons (most recent first)
 */
export async function fetchLeagueHistory(leagueId: string): Promise<FetchLeagueHistoryResponse> {
  if (!leagueId || typeof leagueId !== 'string' || leagueId.trim() === '') {
    return {
      success: false,
      error: 'Invalid league ID provided',
      code: 'API_ERROR',
    };
  }

  const seasons: LeagueHistorySeason[] = [];
  let currentId: string | null = leagueId.trim();
  let iterationCount = 0;

  console.log(`[fetchLeagueHistory] Starting history fetch for league ${leagueId}`);

  while (currentId && iterationCount < MAX_SEASONS) {
    iterationCount++;

    // Add delay between API calls to respect rate limits
    if (iterationCount > 1) {
      await sleep(API_CALL_DELAY_MS);
    }

    // Fetch league data
    const league = await fetchLeague(currentId);

    if (!league) {
      // If this is the first league and we can't fetch it, return error
      if (iterationCount === 1) {
        return {
          success: false,
          error: `League ${currentId} not found`,
          code: 'NOT_FOUND',
        };
      }
      // Otherwise, just stop the chain
      console.warn(`[fetchLeagueHistory] Could not fetch league ${currentId}, stopping chain`);
      break;
    }

    // Only include completed seasons in history (skip current in-progress seasons)
    if (league.status === 'complete') {
      // Fetch rosters, users, and bracket data for standings
      const [rosters, userMap, bracket] = await Promise.all([
        fetchRosters(currentId),
        fetchLeagueUsers(currentId),
        fetchWinnersBracket(currentId),
      ]);

      // Determine standings from playoff bracket (with fallback to regular season)
      const standings = determineStandings(rosters, userMap, bracket);

      const year = parseInt(league.season, 10);
      const isDynasty = league.settings?.type === 2;

      seasons.push({
        leagueId: league.league_id,
        name: league.name,
        season: league.season,
        year,
        totalRosters: league.total_rosters || rosters.length,
        status: league.status,
        isDynasty,
        avatarUrl: league.avatar ? `https://sleepercdn.com/avatars/${league.avatar}` : undefined,
        rosters,
        ...standings,
      });

      console.log(`[fetchLeagueHistory] Found completed season ${league.season} for ${league.name}`);
    } else {
      console.log(`[fetchLeagueHistory] Skipping season ${league.season} (status: ${league.status})`);
    }

    // Move to previous league
    currentId = league.previous_league_id ?? null;
  }

  if (iterationCount >= MAX_SEASONS) {
    console.warn(`[fetchLeagueHistory] Reached max seasons limit (${MAX_SEASONS})`);
  }

  console.log(`[fetchLeagueHistory] Found ${seasons.length} completed seasons for league ${leagueId}`);

  return {
    success: true,
    seasons,
    currentLeagueId: leagueId,
  };
}

/**
 * Fetch only previous seasons (excludes current league even if complete)
 * Useful when you only want historical data
 */
export async function fetchPreviousSeasons(leagueId: string): Promise<FetchLeagueHistoryResponse> {
  // First get the current league to find previous_league_id
  const currentLeague = await fetchLeague(leagueId);

  if (!currentLeague) {
    return {
      success: false,
      error: `League ${leagueId} not found`,
      code: 'NOT_FOUND',
    };
  }

  // If no previous league, return empty array
  if (!currentLeague.previous_league_id) {
    console.log(`[fetchPreviousSeasons] League ${leagueId} has no previous seasons`);
    return {
      success: true,
      seasons: [],
      currentLeagueId: leagueId,
    };
  }

  // Fetch history starting from the previous league
  return fetchLeagueHistory(currentLeague.previous_league_id);
}
