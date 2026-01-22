// Data layer for fetching matchups
// Prisma implementation with caching

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

import type { DisplayMatchup, MatchupsResponse, MatchupTeamDisplay } from '@/types/matchups';
import type { Decimal } from '@prisma/client/runtime/client';

export interface GetMatchupsInput {
  leagueSlug: string;
  weekNumber?: number;
  includePredictions?: boolean; // Include commissioner predictions
}

// Default values for current week and total weeks
const DEFAULT_CURRENT_WEEK = 3;
const DEFAULT_TOTAL_WEEKS = 17; // NFL regular season weeks

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

  // Calculate current week based on the latest incomplete matchup or default
  // For now, use the requested week as current if matchups exist
  const currentWeek = matchups.length > 0 ? weekNumber : DEFAULT_CURRENT_WEEK;

  return {
    matchups: displayMatchups,
    currentWeek,
    totalWeeks: DEFAULT_TOTAL_WEEKS,
  };
}

/**
 * Get matchups for a league and week
 *
 * Queries matchups for the specified week with team data.
 * Includes scores (projected or actual) based on completion status.
 * Optionally includes commissioner predictions if the user has permission.
 *
 * @param input - Matchups query parameters
 * @returns MatchupsResponse with bracket data
 */
export async function getMatchups(input: GetMatchupsInput): Promise<MatchupsResponse> {
  const { leagueSlug, weekNumber = DEFAULT_CURRENT_WEEK, includePredictions = true } = input;

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
    return result;
  }

  // Fallback: return empty response if league not found
  // This allows the frontend to handle the empty state gracefully
  return {
    matchups: [],
    currentWeek: weekNumber,
    totalWeeks: DEFAULT_TOTAL_WEEKS,
  };
}
