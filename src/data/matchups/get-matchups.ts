// Data layer for fetching matchups
// Prisma implementation with caching

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';
import { DEFAULT_CHAMPIONSHIP_WEEK, getNFLSeasonState, NFL_TOTAL_WEEKS } from '@/lib/nfl-week';

import type { DisplayMatchup, MatchupsResponse, MatchupsSeasonState, MatchupTeamDisplay } from '@/types/matchups';
import type { Decimal } from '@prisma/client/runtime/client';

export interface GetMatchupsInput {
  leagueSlug: string;
  weekNumber?: number;
  includePredictions?: boolean; // Include commissioner predictions
}

/**
 * Get the league's available weeks and last active week
 */
async function getLeagueMatchupWeeks(
  leagueId: string,
  season: number
): Promise<{ availableWeeks: number[]; lastActiveWeek: number; championshipWeek: number }> {
  const weeksWithMatchups = await prisma.matchup.findMany({
    where: {
      leagueId,
      season,
    },
    select: {
      weekNumber: true,
    },
    distinct: ['weekNumber'],
    orderBy: {
      weekNumber: 'asc',
    },
  });

  const availableWeeks = weeksWithMatchups.map((w) => w.weekNumber);
  const lastActiveWeek = availableWeeks.length > 0 ? Math.max(...availableWeeks) : 1;
  const championshipWeek = Math.min(lastActiveWeek, DEFAULT_CHAMPIONSHIP_WEEK);

  return { availableWeeks, lastActiveWeek, championshipWeek };
}

/**
 * Helper to convert Decimal to number for score fields
 */
function decimalToNumber(value: Decimal | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return Number(value);
}

/**
 * Fetch matchups from database
 */
async function fetchMatchupsFromDb(
  leagueSlug: string,
  weekNumber: number,
  includePredictions: boolean
): Promise<MatchupsResponse | null> {
  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  if (!league) {
    return null;
  }

  // Fetch matchups for the specified week with team data
  const matchups = await prisma.matchup.findMany({
    where: {
      leagueId: league.id,
      weekNumber,
    },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true,
          ownerUsername: true,
          avatarUrl: true,
          wins: true,
          losses: true,
          ties: true,
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          ownerUsername: true,
          avatarUrl: true,
          wins: true,
          losses: true,
          ties: true,
        },
      },
      winner: {
        select: {
          id: true,
        },
      },
      predictions: includePredictions
        ? {
            select: {
              id: true,
              predictedWinnerId: true,
              hypeText: true,
              isFeatured: true,
              status: true,
            },
            where: {
              status: 'published', // Only show published predictions
            },
          }
        : false,
    },
    orderBy: [
      { matchupType: 'asc' }, // regular_season first, then playoff, then toilet_bowl
      { createdAt: 'asc' },
    ],
  });

  // Transform database matchups to DisplayMatchup format
  const displayMatchups: DisplayMatchup[] = matchups.map((matchup) => {
    // Get the first prediction if available (there's only one per matchup due to unique constraint)
    const prediction = includePredictions && matchup.predictions && matchup.predictions[0];

    // Build home team display
    const homeTeam: MatchupTeamDisplay = {
      id: matchup.homeTeam.id,
      name: matchup.homeTeam.name,
      ownerUsername: matchup.homeTeam.ownerUsername ?? undefined,
      avatarUrl: matchup.homeTeam.avatarUrl ?? undefined,
      record: {
        wins: matchup.homeTeam.wins,
        losses: matchup.homeTeam.losses,
        ties: matchup.homeTeam.ties,
      },
      // Use actual score if complete, otherwise use projected score
      score: matchup.isComplete ? decimalToNumber(matchup.homeTeamScore) : decimalToNumber(matchup.homeTeamProjected),
    };

    // Build away team display
    const awayTeam: MatchupTeamDisplay = {
      id: matchup.awayTeam.id,
      name: matchup.awayTeam.name,
      ownerUsername: matchup.awayTeam.ownerUsername ?? undefined,
      avatarUrl: matchup.awayTeam.avatarUrl ?? undefined,
      record: {
        wins: matchup.awayTeam.wins,
        losses: matchup.awayTeam.losses,
        ties: matchup.awayTeam.ties,
      },
      // Use actual score if complete, otherwise use projected score
      score: matchup.isComplete ? decimalToNumber(matchup.awayTeamScore) : decimalToNumber(matchup.awayTeamProjected),
    };

    return {
      id: matchup.id,
      homeTeam,
      awayTeam,
      isComplete: matchup.isComplete,
      winnerId: matchup.winnerId ?? undefined,
      isFeatured: prediction ? prediction.isFeatured : undefined,
      hypeText: prediction ? (prediction.hypeText ?? undefined) : undefined,
      weekNumber: matchup.weekNumber,
    };
  });

  return {
    matchups: displayMatchups,
    currentWeek: weekNumber,
    totalWeeks: NFL_TOTAL_WEEKS,
  };
}

/**
 * Get matchups for a league and week
 *
 * Queries matchups for the specified week with team data.
 * Includes scores (projected or actual) based on completion status.
 * Optionally includes commissioner predictions if the user has permission.
 * 
 * Smart week selection:
 * - During regular season: shows NFL current week
 * - During postseason/offseason: shows league's last active week
 *
 * @param input - Matchups query parameters
 * @returns MatchupsResponse with bracket data
 */
export async function getMatchups(input: GetMatchupsInput): Promise<MatchupsResponse> {
  const nflState = await getNFLSeasonState();
  const { leagueSlug, includePredictions = true } = input;

  // Get league to determine season
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, season: true },
  });

  if (!league) {
    return {
      matchups: [],
      currentWeek: nflState.week,
      totalWeeks: NFL_TOTAL_WEEKS,
    };
  }

  const season = league.season || new Date().getFullYear();

  // Get league's week info for smart defaults
  const leagueWeekInfo = await getLeagueMatchupWeeks(league.id, season);

  // Determine which week to show
  let weekNumber: number;
  if (input.weekNumber !== undefined) {
    weekNumber = input.weekNumber;
  } else if (nflState.isFantasySeasonComplete) {
    weekNumber = leagueWeekInfo.lastActiveWeek;
  } else {
    weekNumber = Math.min(nflState.week, leagueWeekInfo.lastActiveWeek || nflState.week);
  }

  // Build season state
  const seasonState: MatchupsSeasonState = {
    status: nflState.status,
    isSeasonComplete: nflState.isFantasySeasonComplete,
    statusMessage: nflState.isFantasySeasonComplete
      ? `Season Complete - Viewing Week ${weekNumber}`
      : nflState.statusMessage,
    lastActiveWeek: leagueWeekInfo.lastActiveWeek,
    championshipWeek: leagueWeekInfo.championshipWeek,
    availableWeeks: leagueWeekInfo.availableWeeks,
  };

  const cacheKey = ['matchups', leagueSlug, String(weekNumber), includePredictions ? 'predictions' : 'base'];
  const getCachedMatchups = unstable_cache(
    async () => {
      return fetchMatchupsFromDb(leagueSlug, weekNumber, includePredictions);
    },
    cacheKey,
    {
      tags: [`matchups-${leagueSlug}`],
      revalidate: 300, // Cache for 5 minutes (300 seconds)
    }
  );

  const result = await getCachedMatchups();

  if (result) {
    return {
      ...result,
      currentWeek: weekNumber,
      seasonState,
    };
  }

  // Fallback: return empty response if league not found
  return {
    matchups: [],
    currentWeek: weekNumber,
    totalWeeks: NFL_TOTAL_WEEKS,
    seasonState,
  };
}
