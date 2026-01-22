import { Prisma } from '@prisma/client';

import { fetchLeagueHistory } from '@/integrations/sleeper/fetch-league-history';
import { syncSleeperLeague } from '@/jobs/sync-sleeper-league';
import { prisma } from '@/lib/db';

import type { SleeperLeague, SleeperLeagueUser, SleeperRoster } from '@/types/sleeper';
import type { SyncProgressResponse, SyncResult } from '@/types/sync';

// Sleeper API base URL
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

export interface SyncLeagueInput {
  sleeperLeagueId: string;
  sleeperUserId?: string;
  userId?: string; // Optional authenticated user ID for commissioner assignment
}

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
 * Generate a URL-safe slug from a league name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 45); // Max 45 chars to leave room for suffix
}

/**
 * Generate a unique slug by appending numbers if needed
 */
async function generateUniqueSlug(baseName: string): Promise<string> {
  const baseSlug = generateSlug(baseName);

  // Check if base slug is available
  const existingLeague = await prisma.league.findUnique({
    where: { slug: baseSlug },
  });

  if (!existingLeague) {
    return baseSlug;
  }

  // Try appending numbers until we find a unique slug
  for (let i = 2; i <= 100; i++) {
    const candidateSlug = `${baseSlug}-${i}`;
    const exists = await prisma.league.findUnique({
      where: { slug: candidateSlug },
    });
    if (!exists) {
      return candidateSlug;
    }
  }

  // Fallback to random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}-${randomSuffix}`;
}

/**
 * Simulate sync progress (can be called from progress endpoint)
 */
export async function getSyncProgress(input: SyncLeagueInput): Promise<SyncProgressResponse> {
  console.log('Getting sync progress for league:', input.sleeperLeagueId);
  return {
    progress: 45,
    status: 'Importing teams...',
  };
}

/**
 * Sync historical seasons from Sleeper API to SeasonHistory table
 *
 * This function:
 * 1. Fetches all previous seasons by following previous_league_id chain
 * 2. Creates SeasonHistory records for each completed season
 * 3. Skips seasons that already exist in the database
 *
 * @param sleeperLeagueId - Current Sleeper league ID
 * @param dbLeagueId - Database league ID to associate history with
 * @returns Number of seasons synced
 */
async function syncLeagueHistory(sleeperLeagueId: string, dbLeagueId: string): Promise<number> {
  console.log(`[syncLeagueHistory] Starting history sync for league ${sleeperLeagueId}`);

  // Fetch all historical seasons from Sleeper
  const historyResult = await fetchLeagueHistory(sleeperLeagueId);

  if (!historyResult.success) {
    console.error(`[syncLeagueHistory] Failed to fetch history: ${historyResult.error}`);
    return 0;
  }

  const { seasons } = historyResult;

  if (seasons.length === 0) {
    console.log(`[syncLeagueHistory] No historical seasons found for league ${sleeperLeagueId}`);
    return 0;
  }

  console.log(`[syncLeagueHistory] Found ${seasons.length} historical seasons to sync`);

  let syncedCount = 0;

  for (const season of seasons) {
    try {
      // Check if this season already exists
      const existing = await prisma.seasonHistory.findUnique({
        where: {
          league_year_history_unique: {
            leagueId: dbLeagueId,
            year: season.year,
          },
        },
      });

      if (existing) {
        console.log(`[syncLeagueHistory] Season ${season.year} already exists, skipping`);
        continue;
      }

      // Calculate highest weekly score if we have roster data
      let highestWeeklyScore: number | null = null;
      for (const roster of season.rosters) {
        const pts = (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100;
        if (pts > 0 && (highestWeeklyScore === null || pts > highestWeeklyScore)) {
          highestWeeklyScore = pts;
        }
      }

      // Create the SeasonHistory record
      await prisma.seasonHistory.create({
        data: {
          leagueId: dbLeagueId,
          year: season.year,
          champion: season.champion?.name ?? 'Unknown',
          runnerUp: season.runnerUp?.name ?? 'Unknown',
          totalMembers: season.totalRosters,
          thirdPlace: season.thirdPlace?.name ?? null,
          playoffTeams: Math.min(season.totalRosters, 6), // Estimate playoff teams
          highestWeeklyScore: highestWeeklyScore,
          championshipScore:
            season.champion && season.runnerUp
              ? `${season.champion.pointsFor.toFixed(1)} - ${season.runnerUp.pointsFor.toFixed(1)}`
              : null,
          regularSeasonWinner: season.champion?.name ?? null, // Use champion as regular season winner estimate
          seasonSummary: `${season.name} - ${season.year} Season`,
          dynastyContinuityData: season.isDynasty ? { sleeperLeagueId: season.leagueId } : Prisma.JsonNull,
        },
      });

      syncedCount++;
      console.log(
        `[syncLeagueHistory] Synced season ${season.year}: Champion ${season.champion?.name}, Runner-up ${season.runnerUp?.name}`
      );
    } catch (error) {
      console.error(`[syncLeagueHistory] Error syncing season ${season.year}:`, error);
      // Continue with other seasons even if one fails
    }
  }

  console.log(`[syncLeagueHistory] Successfully synced ${syncedCount} historical seasons`);
  return syncedCount;
}

/**
 * Manually trigger a history sync for an existing league
 * Useful for leagues that were synced before history support was added
 */
export async function resyncLeagueHistory(
  leagueSlug: string
): Promise<{ success: boolean; seasonsAdded: number; error?: string }> {
  try {
    // Find the league
    const league = await prisma.league.findUnique({
      where: { slug: leagueSlug },
      select: { id: true, platformLeagueId: true, platform: true },
    });

    if (!league) {
      return { success: false, seasonsAdded: 0, error: 'League not found' };
    }

    if (league.platform !== 'sleeper' || !league.platformLeagueId) {
      return { success: false, seasonsAdded: 0, error: 'League is not a Sleeper league' };
    }

    const seasonsAdded = await syncLeagueHistory(league.platformLeagueId, league.id);

    return { success: true, seasonsAdded };
  } catch (error) {
    console.error('[resyncLeagueHistory] Error:', error);
    return {
      success: false,
      seasonsAdded: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync a league from Sleeper platform to database
 *
 * This function:
 * 1. Validates the Sleeper league ID exists
 * 2. Creates the league record in the database
 * 3. Creates team records for all rosters
 * 4. Creates membership records for roster owners
 * 5. Reserves the URL slug
 */
export async function syncLeague(input: SyncLeagueInput): Promise<SyncResult> {
  const { sleeperLeagueId, userId } = input;

  // Validate input
  if (!sleeperLeagueId || sleeperLeagueId.trim() === '') {
    return {
      success: false,
      error: 'Sleeper league ID is required',
    };
  }

  try {
    // Check if league already exists in database
    const existingLeague = await prisma.league.findFirst({
      where: {
        platform: 'sleeper',
        platformLeagueId: sleeperLeagueId,
      },
    });

    if (existingLeague) {
      const syncResult = await syncSleeperLeague(sleeperLeagueId);
      if (syncResult.success) {
        console.log(
          `Sync completed for existing league ${sleeperLeagueId}: ${syncResult.matchupsUpdated} matchups, ${syncResult.transactionsUpdated} transactions`
        );
      } else {
        console.error(`Sync failed for existing league ${sleeperLeagueId}:`, syncResult.error);
      }

      return {
        success: true,
        leagueSlug: existingLeague.slug,
        message: 'League already synced',
      };
    }

    // Fetch league data from Sleeper API
    const sleeperLeague = await fetchSleeperLeague(sleeperLeagueId);

    if (!sleeperLeague) {
      return {
        success: false,
        error: 'Sleeper league not found. Please check the league ID.',
      };
    }

    // Fetch rosters and users in parallel
    const [rosters, leagueUsers] = await Promise.all([
      fetchSleeperRosters(sleeperLeagueId),
      fetchSleeperLeagueUsers(sleeperLeagueId),
    ]);

    // Create a map of user_id -> user data for roster name lookups
    const userMap = new Map(leagueUsers.map((user) => [user.user_id, user]));

    // Generate unique slug for the league
    const leagueSlug = await generateUniqueSlug(sleeperLeague.name);

    // Determine if this is a dynasty league
    const isDynasty = sleeperLeague.settings?.type === 2;

    // Parse season as integer
    const season = parseInt(sleeperLeague.season, 10) || new Date().getFullYear();

    // Use a transaction to create league, teams, and memberships atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the league record
      const league = await tx.league.create({
        data: {
          slug: leagueSlug,
          name: sleeperLeague.name,
          platform: 'sleeper',
          platformLeagueId: sleeperLeagueId,
          teamCount: sleeperLeague.total_rosters || rosters.length,
          season,
          isDynasty,
          avatarUrl: sleeperLeague.avatar ? `https://sleepercdn.com/avatars/${sleeperLeague.avatar}` : null,
          visibility: 'private', // Default to private until commissioner makes it public
          joinRule: 'approval_required',
          creatorId: userId || null,
        },
      });

      // 2. Create team records for each roster
      const teamPromises = rosters.map(async (roster) => {
        // Find the user associated with this roster
        const ownerUser = roster.owner_id ? userMap.get(roster.owner_id) : null;

        // Generate team name from user data or roster position
        const teamName = ownerUser?.metadata?.team_name || ownerUser?.display_name || `Team ${roster.roster_id}`;

        // Calculate points scored from settings
        const pointsScored = roster.settings
          ? (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100
          : null;

        return tx.team.create({
          data: {
            leagueId: league.id,
            name: teamName,
            ownerUsername: ownerUser?.display_name || null,
            sleeperUsername: ownerUser?.display_name || null,
            externalRosterId: String(roster.roster_id),
            avatarUrl: ownerUser?.avatar ? `https://sleepercdn.com/avatars/${ownerUser.avatar}` : null,
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            ties: roster.settings?.ties || 0,
            pointsScored: pointsScored !== null ? pointsScored : undefined,
            currentSeason: season,
            stableFantasyUserId: roster.owner_id || null,
          },
        });
      });

      const teams = await Promise.all(teamPromises);

      // 3. If userId is provided, create commissioner membership
      if (userId) {
        await tx.leagueMembership.create({
          data: {
            userId,
            leagueId: league.id,
            role: 'commissioner',
            status: 'approved',
          },
        });
      }

      // 4. Reserve the URL slug in the slugs table
      await tx.slug.create({
        data: {
          slug: leagueSlug,
          entityType: 'league',
          entityId: league.id,
          createdById: userId || null,
        },
      });

      // 5. Create default league settings
      await tx.leagueSettings.create({
        data: {
          leagueId: league.id,
          pickemsEnabled: true,
          powerRankingsEnabled: true,
          bracketEnabled: true,
          fanAccessEnabled: true,
        },
      });

      return {
        league,
        teams,
        teamCount: teams.length,
      };
    });

    const syncResult = await syncSleeperLeague(sleeperLeagueId);
    if (syncResult.success) {
      console.log(
        `Sync completed for league ${sleeperLeagueId}: ${syncResult.matchupsUpdated} matchups, ${syncResult.transactionsUpdated} transactions`
      );
    } else {
      console.error(`Sync failed for league ${sleeperLeagueId}:`, syncResult.error);
    }

    // 7. Fetch and store historical seasons from Sleeper in the background
    // This follows the previous_league_id chain to get all past seasons
    syncLeagueHistory(sleeperLeagueId, result.league.id)
      .then((historyCount) => {
        if (historyCount > 0) {
          console.log(`Synced ${historyCount} historical seasons for league ${sleeperLeagueId}`);
        }
      })
      .catch((err) => {
        console.error(`Error syncing league history for ${sleeperLeagueId}:`, err);
      });

    return {
      success: true,
      leagueSlug: result.league.slug,
      message: `Successfully synced league with ${result.teamCount} teams`,
    };
  } catch (error) {
    console.error('Error syncing league:', error);

    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return {
          success: false,
          error: 'A league with this name or ID already exists',
        };
      }
    }

    return {
      success: false,
      error: 'Failed to sync league. Please try again.',
    };
  }
}
