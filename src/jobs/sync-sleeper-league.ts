/**
 * Sleeper League Sync Job (task-50)
 *
 * Background job to sync league data from Sleeper API on schedule.
 * - Runs on cron schedule (every 30 minutes during season)
 * - Fetches league, rosters, matchups, transactions
 * - Uses differential sync with checksums
 * - Updates database with new/changed data only
 */

import { createHash } from 'crypto';

import { prisma, withRetry } from '@/lib/db';

import { fetchSleeperPlayers, getPlayerById } from '@/integrations/sleeper/fetch-players';

import type { SleeperPlayersResponse } from '@/types/sleeper';
import type { SleeperLeague, SleeperLeagueUser, SleeperRoster } from '@/types/sleeper';

// Sleeper API base URL
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

// Current NFL season - adjust as needed
const CURRENT_SEASON = 2025;

// Cron schedule: every 30 minutes
export const SYNC_CRON_SCHEDULE = '*/30 * * * *';

// ============================================================================
// Types
// ============================================================================

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number | null;
  custom_points: number | null;
  starters: string[] | null;
  starters_points: number[] | null;
  players: string[] | null;
  players_points: Record<string, number> | null;
}

export interface SleeperTransaction {
  type: 'trade' | 'free_agent' | 'waiver';
  transaction_id: string;
  status: 'complete' | 'failed';
  status_updated: number;
  roster_ids: number[];
  leg: number;
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: unknown[] | null;
  creator: string;
  created: number;
  waiver_budget: unknown[] | null;
  settings?: {
    waiver_bid?: number;
  };
}

export interface SyncJobResult {
  success: boolean;
  leagueId: string;
  leagueSlug: string;
  matchupsUpdated: number;
  transactionsUpdated: number;
  teamsUpdated: number;
  hasChanges: boolean;
  error?: string;
}

export interface SyncAllResult {
  success: boolean;
  totalLeagues: number;
  successfulSyncs: number;
  failedSyncs: number;
  results: SyncJobResult[];
}

// ============================================================================
// Checksum Utilities
// ============================================================================

/**
 * Generate a checksum for data to detect changes
 */
function generateChecksum(data: unknown): string {
  const json = JSON.stringify(data);
  return createHash('sha256').update(json).digest('hex').substring(0, 64);
}

/**
 * Compare checksums to detect changes
 */
function hasChanges(oldChecksum: string | null | undefined, newChecksum: string): boolean {
  return oldChecksum !== newChecksum;
}

// ============================================================================
// Sleeper API Functions
// ============================================================================

/**
 * Fetch league data from Sleeper API
 */
async function fetchSleeperLeague(leagueId: string): Promise<SleeperLeague | null> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Sleeper API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching Sleeper league:', error);
    return null;
  }
}

/**
 * Fetch roster data from Sleeper API
 */
async function fetchSleeperRosters(leagueId: string): Promise<SleeperRoster[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/rosters`);
    if (!response.ok) {
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching Sleeper rosters:', error);
    return [];
  }
}

/**
 * Fetch league users from Sleeper API
 */
async function fetchSleeperLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/users`);
    if (!response.ok) {
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching Sleeper league users:', error);
    return [];
  }
}

/**
 * Fetch matchups for a specific week from Sleeper API
 */
export async function fetchSleeperMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/matchups/${week}`);
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Sleeper API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching Sleeper matchups for week ${week}:`, error);
    return [];
  }
}

/**
 * Fetch transactions for a league from Sleeper API
 */
export async function fetchSleeperTransactions(leagueId: string, week?: number): Promise<SleeperTransaction[]> {
  try {
    const url = week
      ? `${SLEEPER_API_BASE}/league/${leagueId}/transactions/${week}`
      : `${SLEEPER_API_BASE}/league/${leagueId}/transactions/1`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Sleeper API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching Sleeper transactions for week ${week}:`, error);
    return [];
  }
}

/**
 * Fetch all matchups for all weeks
 */
async function fetchAllMatchups(leagueId: string, maxWeek = 18): Promise<Map<number, SleeperMatchup[]>> {
  const matchupsByWeek = new Map<number, SleeperMatchup[]>();

  // Fetch matchups for all weeks in parallel
  const fetchPromises = Array.from({ length: maxWeek }, (_, i) => i + 1).map(async (week) => {
    const matchups = await fetchSleeperMatchups(leagueId, week);
    return { week, matchups };
  });

  const results = await Promise.all(fetchPromises);
  results.forEach(({ week, matchups }) => {
    if (matchups.length > 0) {
      matchupsByWeek.set(week, matchups);
    }
  });

  return matchupsByWeek;
}

/**
 * Fetch all transactions for all weeks
 */
async function fetchAllTransactions(leagueId: string, maxWeek = 18): Promise<SleeperTransaction[]> {
  // Fetch transactions for all weeks in parallel
  const fetchPromises = Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) =>
    fetchSleeperTransactions(leagueId, week)
  );

  const results = await Promise.all(fetchPromises);
  return results.flat();
}

// ============================================================================
// Sync Functions
// ============================================================================

/**
 * Sync teams/rosters from Sleeper API
 */
async function syncTeams(
  leagueDbId: string,
  rosters: SleeperRoster[],
  users: SleeperLeagueUser[],
  season: number
): Promise<number> {
  // Create a map of owner_id -> user data
  const userMap = new Map(users.map((user) => [user.user_id, user]));

  let teamsUpdated = 0;

  for (const roster of rosters) {
    const ownerUser = roster.owner_id ? userMap.get(roster.owner_id) : null;
    const teamName = ownerUser?.metadata?.team_name || ownerUser?.display_name || `Team ${roster.roster_id}`;
    const pointsScored = roster.settings
      ? (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100
      : null;

    // Upsert team data
    await prisma.team.upsert({
      where: {
        league_roster_unique: {
          leagueId: leagueDbId,
          externalRosterId: String(roster.roster_id),
        },
      },
      create: {
        leagueId: leagueDbId,
        name: teamName,
        ownerUsername: ownerUser?.display_name || null,
        sleeperUsername: ownerUser?.display_name || null,
        externalRosterId: String(roster.roster_id),
        platformTeamId: String(roster.roster_id),
        avatarUrl: ownerUser?.avatar ? `https://sleepercdn.com/avatars/${ownerUser.avatar}` : null,
        wins: roster.settings?.wins || 0,
        losses: roster.settings?.losses || 0,
        ties: roster.settings?.ties || 0,
        pointsScored: pointsScored !== null ? pointsScored : undefined,
        currentSeason: season,
        stableFantasyUserId: roster.owner_id || null,
      },
      update: {
        name: teamName,
        ownerUsername: ownerUser?.display_name || null,
        wins: roster.settings?.wins || 0,
        losses: roster.settings?.losses || 0,
        ties: roster.settings?.ties || 0,
        pointsScored: pointsScored !== null ? pointsScored : undefined,
        currentSeason: season,
        platformTeamId: String(roster.roster_id),
      },
    });

    teamsUpdated++;
  }

  return teamsUpdated;
}

/**
 * Sync matchups from Sleeper API
 */
async function syncMatchups(
  leagueDbId: string,
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  season: number
): Promise<number> {
  let matchupsUpdated = 0;

  // Get existing teams for roster mapping
  const teams = await prisma.team.findMany({
    where: { leagueId: leagueDbId },
    select: { id: true, externalRosterId: true },
  });
  const teamMap = new Map<string, string>(
    teams
      .filter((t) => t.externalRosterId !== null)
      .map((t) => [t.externalRosterId as string, t.id])
  );

  for (const [week, matchups] of matchupsByWeek) {
    // Group matchups by matchup_id to pair teams
    const matchupGroups = new Map<number, SleeperMatchup[]>();
    for (const matchup of matchups) {
      const existing = matchupGroups.get(matchup.matchup_id) || [];
      existing.push(matchup);
      matchupGroups.set(matchup.matchup_id, existing);
    }

    for (const [matchupId, matchupPair] of matchupGroups) {
      if (matchupPair.length !== 2) continue; // Skip invalid matchups

      const team1 = matchupPair[0];
      const team2 = matchupPair[1];
      if (!team1 || !team2) continue; // TypeScript safety check

      const homeTeamId = teamMap.get(String(team1.roster_id));
      const awayTeamId = teamMap.get(String(team2.roster_id));

      if (!homeTeamId || !awayTeamId) continue;

      const homeScore = team1.points || team1.custom_points;
      const awayScore = team2.points || team2.custom_points;
      const isComplete = homeScore !== null && awayScore !== null;

      let winnerId: string | null = null;
      if (isComplete && homeScore !== null && awayScore !== null) {
        if (homeScore > awayScore) {
          winnerId = homeTeamId;
        } else if (awayScore > homeScore) {
          winnerId = awayTeamId;
        }
        // Tie if scores are equal
      }

      // Upsert matchup data
      await prisma.matchup.upsert({
        where: {
          league_week_matchup_unique: {
            leagueId: leagueDbId,
            season,
            weekNumber: week,
            homeTeamId,
            awayTeamId,
          },
        },
        create: {
          leagueId: leagueDbId,
          season,
          weekNumber: week,
          homeTeamId,
          awayTeamId,
          homeScore: homeScore || undefined,
          awayScore: awayScore || undefined,
          homeTeamScore: homeScore !== null ? homeScore : undefined,
          awayTeamScore: awayScore !== null ? awayScore : undefined,
          isComplete,
          winnerId,
          externalMatchupId: String(matchupId),
        },
        update: {
          homeScore: homeScore || undefined,
          awayScore: awayScore || undefined,
          homeTeamScore: homeScore !== null ? homeScore : undefined,
          awayTeamScore: awayScore !== null ? awayScore : undefined,
          isComplete,
          winnerId,
        },
      });

      matchupsUpdated++;
    }
  }

  return matchupsUpdated;
}

/**
 * Look up player name from Sleeper player database
 * Returns the full name if found, otherwise returns the player ID as fallback
 */
function getPlayerName(players: SleeperPlayersResponse | null, playerId: string): string {
  if (!players) {
    return playerId; // Fallback to ID if players database not available
  }

  const player = getPlayerById(players, playerId);
  if (player?.full_name) {
    return player.full_name;
  }
  // Try first + last name as fallback
  if (player?.first_name && player?.last_name) {
    return `${player.first_name} ${player.last_name}`;
  }
  return playerId; // Fallback to ID if player not found
}

/**
 * Build trade details for storage in notes field
 * Organizes assets by team for proper display
 */
function buildTradeDetails(
  tx: SleeperTransaction,
  players: SleeperPlayersResponse | null,
  teamMap: Map<string, string>
): {
  teams: Array<{
    rosterId: number;
    teamId: string;
    playersIn: string[];
    playersOut: string[];
    draftPicksIn: string[];
    draftPicksOut: string[];
    faabIn: number;
    faabOut: number;
  }>;
} {
  // Build a map of what each roster received and gave away
  const rosterAssets = new Map<
    number,
    {
      playersIn: string[];
      playersOut: string[];
      draftPicksIn: string[];
      draftPicksOut: string[];
      faabIn: number;
      faabOut: number;
    }
  >();

  // Initialize for all rosters involved
  for (const rosterId of tx.roster_ids) {
    rosterAssets.set(rosterId, {
      playersIn: [],
      playersOut: [],
      draftPicksIn: [],
      draftPicksOut: [],
      faabIn: 0,
      faabOut: 0,
    });
  }

  // Process player adds (who received which players)
  if (tx.adds) {
    for (const [playerId, rosterId] of Object.entries(tx.adds)) {
      const assets = rosterAssets.get(rosterId);
      if (assets) {
        assets.playersIn.push(getPlayerName(players, playerId));
      }
    }
  }

  // Process player drops (who gave away which players)
  if (tx.drops) {
    for (const [playerId, rosterId] of Object.entries(tx.drops)) {
      const assets = rosterAssets.get(rosterId);
      if (assets) {
        assets.playersOut.push(getPlayerName(players, playerId));
      }
    }
  }

  // Process draft picks
  if (tx.draft_picks && Array.isArray(tx.draft_picks)) {
    for (const pick of tx.draft_picks) {
      const draftPick = pick as {
        season?: string;
        round?: number;
        roster_id?: number;
        previous_owner_id?: number;
      };
      if (draftPick.season && draftPick.round !== undefined) {
        const pickLabel = `${draftPick.season} Round ${draftPick.round} Pick`;

        // The roster_id is who now owns the pick (received it)
        if (draftPick.roster_id !== undefined) {
          const receiverAssets = rosterAssets.get(draftPick.roster_id);
          if (receiverAssets) {
            receiverAssets.draftPicksIn.push(pickLabel);
          }
        }

        // The previous_owner_id is who gave away the pick
        if (draftPick.previous_owner_id !== undefined) {
          const giverAssets = rosterAssets.get(draftPick.previous_owner_id);
          if (giverAssets) {
            giverAssets.draftPicksOut.push(pickLabel);
          }
        }
      }
    }
  }

  // Process FAAB/waiver budget transfers
  if (tx.waiver_budget && Array.isArray(tx.waiver_budget)) {
    for (const budget of tx.waiver_budget) {
      const transfer = budget as { sender?: number; receiver?: number; amount?: number };
      if (transfer.amount && transfer.amount > 0) {
        if (transfer.sender !== undefined) {
          const senderAssets = rosterAssets.get(transfer.sender);
          if (senderAssets) {
            senderAssets.faabOut += transfer.amount;
          }
        }
        if (transfer.receiver !== undefined) {
          const receiverAssets = rosterAssets.get(transfer.receiver);
          if (receiverAssets) {
            receiverAssets.faabIn += transfer.amount;
          }
        }
      }
    }
  }

  // Convert to array format with team IDs
  const teams: Array<{
    rosterId: number;
    teamId: string;
    playersIn: string[];
    playersOut: string[];
    draftPicksIn: string[];
    draftPicksOut: string[];
    faabIn: number;
    faabOut: number;
  }> = [];

  for (const [rosterId, assets] of rosterAssets) {
    const teamId = teamMap.get(String(rosterId));
    if (teamId) {
      teams.push({
        rosterId,
        teamId,
        ...assets,
      });
    }
  }

  return { teams };
}

/**
 * Sync transactions from Sleeper API
 */
async function syncTransactions(
  leagueDbId: string,
  transactions: SleeperTransaction[],
  players: SleeperPlayersResponse | null,
  week?: number
): Promise<number> {
  if (transactions.length === 0) return 0;

  // Get existing teams for roster mapping (include name for trade details)
  const teams = await prisma.team.findMany({
    where: { leagueId: leagueDbId },
    select: { id: true, externalRosterId: true, name: true },
  });
  const teamMap = new Map<string, string>(
    teams
      .filter((t) => t.externalRosterId !== null)
      .map((t) => [t.externalRosterId as string, t.id])
  );
  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  let transactionsUpdated = 0;

  for (const tx of transactions) {
    if (tx.status !== 'complete') continue;

    // Get primary team involved
    const primaryRosterId = tx.roster_ids[0];
    const teamId = teamMap.get(String(primaryRosterId));
    if (!teamId) continue;

    // Determine transaction type and get player name
    let type: 'trade' | 'add' | 'drop' | 'waiver';
    let playerName = 'Unknown Player';
    let tradePartnerTeamId: string | null = null;
    let notes: string | null = null;

    if (tx.type === 'trade') {
      type = 'trade';

      // Build detailed trade information
      const tradeDetails = buildTradeDetails(tx, players, teamMap);

      // Get trade partner team ID (second roster in the trade)
      if (tx.roster_ids.length >= 2) {
        const partnerRosterId = tx.roster_ids[1];
        tradePartnerTeamId = teamMap.get(String(partnerRosterId)) || null;
      }

      // Find a representative player name for the trade
      if (tx.adds) {
        const playerId = Object.keys(tx.adds)[0];
        if (playerId) {
          playerName = getPlayerName(players, playerId);
        } else {
          playerName = 'Trade';
        }
      } else if (tx.drops) {
        const playerId = Object.keys(tx.drops)[0];
        if (playerId) {
          playerName = getPlayerName(players, playerId);
        } else {
          playerName = 'Trade';
        }
      } else {
        playerName = 'Trade';
      }

      // Store detailed trade info including team names
      const teamsWithNames = tradeDetails.teams.map((team) => ({
        ...team,
        teamName: teamNameMap.get(team.teamId) || 'Unknown Team',
      }));

      notes = JSON.stringify({
        transactionId: tx.transaction_id,
        adds: tx.adds,
        drops: tx.drops,
        tradeDetails: {
          teams: teamsWithNames,
        },
      });
    } else if (tx.type === 'waiver') {
      type = 'waiver';
      if (tx.adds) {
        const playerId = Object.keys(tx.adds)[0];
        if (playerId) {
          playerName = getPlayerName(players, playerId);
        }
      }
      notes = JSON.stringify({
        transactionId: tx.transaction_id,
        adds: tx.adds,
        drops: tx.drops,
      });
    } else if (tx.adds && Object.keys(tx.adds).length > 0) {
      type = 'add';
      const playerId = Object.keys(tx.adds)[0];
      if (playerId) {
        playerName = getPlayerName(players, playerId);
      }
      notes = JSON.stringify({
        transactionId: tx.transaction_id,
        adds: tx.adds,
        drops: tx.drops,
      });
    } else if (tx.drops && Object.keys(tx.drops).length > 0) {
      type = 'drop';
      const playerId = Object.keys(tx.drops)[0];
      if (playerId) {
        playerName = getPlayerName(players, playerId);
      }
      notes = JSON.stringify({
        transactionId: tx.transaction_id,
        adds: tx.adds,
        drops: tx.drops,
      });
    } else {
      continue; // Skip unknown transaction types
    }

    // Create transaction if it doesn't exist
    // We use created timestamp and type as unique identifier
    const existingTx = await prisma.transaction.findFirst({
      where: {
        leagueId: leagueDbId,
        teamId,
        type,
        timestamp: new Date(tx.created),
      },
    });

    if (!existingTx) {
      await prisma.transaction.create({
        data: {
          leagueId: leagueDbId,
          weekNumber: week || tx.leg || 1,
          type,
          teamId,
          playerName,
          timestamp: new Date(tx.created),
          faabAmount: tx.settings?.waiver_bid,
          tradePartnerTeamId,
          notes,
        },
      });
      transactionsUpdated++;
    } else if (type === 'trade' && !existingTx.tradePartnerTeamId && tradePartnerTeamId) {
      // Update existing trades that are missing trade details
      await prisma.transaction.update({
        where: { id: existingTx.id },
        data: {
          tradePartnerTeamId,
          notes,
        },
      });
      transactionsUpdated++;
    }
  }

  return transactionsUpdated;
}

// ============================================================================
// Main Sync Job
// ============================================================================

/**
 * Sync a single league from Sleeper
 * Uses differential sync with checksums to only update changed data
 */
export async function syncSleeperLeague(platformLeagueId: string): Promise<SyncJobResult> {
  // Find the league in our database
  const league = await prisma.league.findFirst({
    where: {
      platform: 'sleeper',
      platformLeagueId,
    },
  });

  if (!league) {
    return {
      success: false,
      leagueId: '',
      leagueSlug: '',
      matchupsUpdated: 0,
      transactionsUpdated: 0,
      teamsUpdated: 0,
      hasChanges: false,
      error: 'League not found in database',
    };
  }

  // Skip sync for inactive leagues (old seasons)
  if (league.season !== CURRENT_SEASON) {
    return {
      success: true,
      leagueId: league.id,
      leagueSlug: league.slug,
      matchupsUpdated: 0,
      transactionsUpdated: 0,
      teamsUpdated: 0,
      hasChanges: false,
      error: 'Skipped: League is not in current season',
    };
  }

  try {
    // Fetch all data from Sleeper API in parallel
    const [sleeperLeague, rosters, users, matchupsByWeek, transactions, players] = await Promise.all([
      fetchSleeperLeague(platformLeagueId),
      fetchSleeperRosters(platformLeagueId),
      fetchSleeperLeagueUsers(platformLeagueId),
      fetchAllMatchups(platformLeagueId),
      fetchAllTransactions(platformLeagueId),
      fetchSleeperPlayers(), // Fetch player database for name lookups
    ]);

    if (!sleeperLeague) {
      return {
        success: false,
        leagueId: league.id,
        leagueSlug: league.slug,
        matchupsUpdated: 0,
        transactionsUpdated: 0,
        teamsUpdated: 0,
        hasChanges: false,
        error: 'Failed to fetch league data from Sleeper API',
      };
    }

    // Generate checksum for the fetched data
    const dataForChecksum = {
      league: sleeperLeague,
      rosters: rosters.map((r) => ({
        id: r.roster_id,
        wins: r.settings?.wins,
        losses: r.settings?.losses,
        fpts: r.settings?.fpts,
      })),
      matchupCount: matchupsByWeek.size,
      transactionCount: transactions.length,
    };
    const newChecksum = generateChecksum(dataForChecksum);

    // Check if data has changed using checksum
    const dataChanged = hasChanges(league.lastSyncChecksum, newChecksum);

    if (!dataChanged) {
      // Update last sync timestamp even if no changes
      await prisma.league.update({
        where: { id: league.id },
        data: { lastSyncedAt: new Date() },
      });

      return {
        success: true,
        leagueId: league.id,
        leagueSlug: league.slug,
        matchupsUpdated: 0,
        transactionsUpdated: 0,
        teamsUpdated: 0,
        hasChanges: false,
      };
    }

    // Perform sync within retry wrapper
    const result = await withRetry(async () => {
      // Sync teams
      const teamsUpdated = await syncTeams(league.id, rosters, users, league.season);

      // Sync matchups
      const matchupsUpdated = await syncMatchups(league.id, matchupsByWeek, league.season);

      // Sync transactions (pass players database for name lookups)
      const transactionsUpdated = await syncTransactions(league.id, transactions, players);

      // Update league with new checksum and sync timestamp
      await prisma.league.update({
        where: { id: league.id },
        data: {
          lastSyncChecksum: newChecksum,
          lastSyncedAt: new Date(),
          teamCount: rosters.length,
        },
      });

      return { teamsUpdated, matchupsUpdated, transactionsUpdated };
    });

    return {
      success: true,
      leagueId: league.id,
      leagueSlug: league.slug,
      matchupsUpdated: result.matchupsUpdated,
      transactionsUpdated: result.transactionsUpdated,
      teamsUpdated: result.teamsUpdated,
      hasChanges: true,
    };
  } catch (error) {
    console.error(`Error syncing league ${platformLeagueId}:`, error);
    return {
      success: false,
      leagueId: league.id,
      leagueSlug: league.slug,
      matchupsUpdated: 0,
      transactionsUpdated: 0,
      teamsUpdated: 0,
      hasChanges: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync all active Sleeper leagues
 * This is the main cron job entry point
 */
export async function syncAllSleeperLeagues(): Promise<SyncAllResult> {
  // Get all active Sleeper leagues (current season only)
  const leagues = await prisma.league.findMany({
    where: {
      platform: 'sleeper',
      platformLeagueId: { not: null },
      season: CURRENT_SEASON,
    },
    select: {
      id: true,
      slug: true,
      platformLeagueId: true,
    },
  });

  const results: SyncJobResult[] = [];
  let successfulSyncs = 0;
  let failedSyncs = 0;

  // Sync leagues sequentially to avoid rate limiting
  for (const league of leagues) {
    if (!league.platformLeagueId) continue;

    const result = await syncSleeperLeague(league.platformLeagueId);
    results.push(result);

    if (result.success) {
      successfulSyncs++;
    } else {
      failedSyncs++;
    }

    // Small delay between syncs to be nice to the Sleeper API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    success: failedSyncs === 0,
    totalLeagues: leagues.length,
    successfulSyncs,
    failedSyncs,
    results,
  };
}

/**
 * Check if a league should be synced based on last sync time
 */
export function shouldSyncLeague(lastSyncedAt: Date | null | undefined): boolean {
  if (!lastSyncedAt) return true;

  const now = new Date();
  const timeSinceSync = now.getTime() - lastSyncedAt.getTime();
  const thirtyMinutes = 30 * 60 * 1000;

  return timeSinceSync >= thirtyMinutes;
}

/**
 * Get sync status for a league
 */
export async function getLeagueSyncStatus(leagueId: string): Promise<{
  lastSyncedAt: Date | null;
  lastSyncChecksum: string | null;
  needsSync: boolean;
}> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      lastSyncedAt: true,
      lastSyncChecksum: true,
    },
  });

  return {
    lastSyncedAt: league?.lastSyncedAt || null,
    lastSyncChecksum: league?.lastSyncChecksum || null,
    needsSync: shouldSyncLeague(league?.lastSyncedAt),
  };
}
