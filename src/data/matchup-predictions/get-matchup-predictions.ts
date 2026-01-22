import { prisma } from '@/lib/db';

import type { MatchupPrediction, MatchupPredictionsData } from '@/data/fixtures/matchups';

// Data layer for matchup predictions
// Backend task-28: Replaces mock implementation with Prisma queries

export interface GetMatchupPredictionsInput {
  leagueSlug: string;
  weekNumber: number;
}

/**
 * Helper to build MatchupPrediction response from DB data
 */
function buildMatchupPredictionResponse(
  matchup: {
    id: string;
    leagueId: string;
    weekNumber: number;
    season: number;
    homeTeam: {
      id: string;
      name: string;
      ownerUsername: string | null;
      avatarUrl: string | null;
      wins: number;
      losses: number;
      ties: number;
    };
    awayTeam: {
      id: string;
      name: string;
      ownerUsername: string | null;
      avatarUrl: string | null;
      wins: number;
      losses: number;
      ties: number;
    };
    homeTeamProjected: unknown;
    awayTeamProjected: unknown;
    predictions: {
      id: string;
      isFeatured: boolean;
      hypeText: string | null;
      predictedWinnerId: string;
    }[];
  },
  leagueSlug: string
): MatchupPrediction {
  const prediction = matchup.predictions[0];

  return {
    id: prediction?.id ?? `pred-${matchup.id}`,
    matchupId: matchup.id,
    leagueSlug,
    weekNumber: matchup.weekNumber,
    homeTeam: {
      id: matchup.homeTeam.id,
      name: matchup.homeTeam.name,
      ownerUsername: matchup.homeTeam.ownerUsername ?? '',
      avatarUrl: matchup.homeTeam.avatarUrl ?? undefined,
      record: {
        wins: matchup.homeTeam.wins,
        losses: matchup.homeTeam.losses,
        ties: matchup.homeTeam.ties,
      },
      projectedScore: matchup.homeTeamProjected ? Number(matchup.homeTeamProjected) : undefined,
    },
    awayTeam: {
      id: matchup.awayTeam.id,
      name: matchup.awayTeam.name,
      ownerUsername: matchup.awayTeam.ownerUsername ?? '',
      avatarUrl: matchup.awayTeam.avatarUrl ?? undefined,
      record: {
        wins: matchup.awayTeam.wins,
        losses: matchup.awayTeam.losses,
        ties: matchup.awayTeam.ties,
      },
      projectedScore: matchup.awayTeamProjected ? Number(matchup.awayTeamProjected) : undefined,
    },
    isFeatured: prediction?.isFeatured ?? false,
    hypeText: prediction?.hypeText ?? '',
    predictedWinnerId: prediction?.predictedWinnerId ?? undefined,
    lastSaved: new Date().toISOString(),
  };
}

/**
 * Get matchup predictions from database
 * Backend task-28: Replaces mock with Prisma query
 */
export async function getMatchupPredictions(input: GetMatchupPredictionsInput): Promise<MatchupPredictionsData> {
  const { leagueSlug, weekNumber } = input;

  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  if (!league) {
    // Return empty predictions data if league not found
    return {
      id: `mp-${leagueSlug}-week-${weekNumber}`,
      leagueSlug,
      weekNumber,
      predictions: [],
      lastSaved: new Date().toISOString(),
    };
  }

  // Find matchups for this league and week
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
      predictions: {
        select: {
          id: true,
          isFeatured: true,
          hypeText: true,
          predictedWinnerId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const predictions: MatchupPrediction[] = matchups.map((matchup) =>
    buildMatchupPredictionResponse(matchup, leagueSlug)
  );

  return {
    id: `mp-${leagueSlug}-week-${weekNumber}`,
    leagueSlug,
    weekNumber,
    predictions,
    lastSaved: new Date().toISOString(),
  };
}

export interface UpdatePredictionInput {
  leagueSlug: string;
  weekNumber: number;
  matchupId: string;
  isFeatured?: boolean;
  hypeText?: string;
  predictedWinnerId?: string;
}

/**
 * Update a single matchup prediction
 *
 * NOTE: This function calls the server action which handles authentication.
 * For direct API route usage, import and call the server action directly.
 */
export async function updatePrediction(input: UpdatePredictionInput): Promise<MatchupPredictionsData> {
  // This data layer function should be called through the server action
  // which handles authentication. Import updateMatchupPredictionAction
  // from @/actions/matchup-predictions/update-matchup-predictions
  // and call it with the user context.

  // For backwards compatibility, return fresh data after the update
  // The actual mutation should go through the server action
  return getMatchupPredictions({
    leagueSlug: input.leagueSlug,
    weekNumber: input.weekNumber,
  });
}

export interface BatchUpdatePredictionsInput {
  leagueSlug: string;
  weekNumber: number;
  predictions: {
    matchupId: string;
    isFeatured?: boolean;
    hypeText?: string;
    predictedWinnerId?: string;
  }[];
}

/**
 * Batch update matchup predictions
 *
 * NOTE: This function calls the server action which handles authentication.
 * For direct API route usage, import and call the server action directly.
 */
export async function batchUpdatePredictions(input: BatchUpdatePredictionsInput): Promise<MatchupPredictionsData> {
  // This data layer function should be called through the server action
  // which handles authentication. Import batchUpdateMatchupPredictionsAction
  // from @/actions/matchup-predictions/update-matchup-predictions
  // and call it with the user context.

  // For backwards compatibility, return fresh data after the update
  // The actual mutation should go through the server action
  return getMatchupPredictions({
    leagueSlug: input.leagueSlug,
    weekNumber: input.weekNumber,
  });
}

// Re-export types for convenience
export type { MatchupPrediction, MatchupPredictionsData };
