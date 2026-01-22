'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { authActionClient } from '@/actions/safe-action';
import { requireCommissioner } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

import type { MatchupPrediction, MatchupPredictionsData } from '@/data/fixtures/matchups';

// Schema for a single prediction update
const predictionUpdateSchema = z.object({
  matchupId: z.string().min(1),
  isFeatured: z.boolean().optional(),
  hypeText: z.string().optional(),
  predictedWinnerId: z.string().nullable().optional(),
  predictedHomeScore: z.number().optional(),
  predictedAwayScore: z.number().optional(),
  predictionRationale: z.string().optional(),
});

// Schema for updating a single matchup prediction
const updateMatchupPredictionSchema = z.object({
  leagueSlug: z.string().min(1),
  weekNumber: z.number().int().positive(),
  matchupId: z.string().min(1),
  isFeatured: z.boolean().optional(),
  hypeText: z.string().optional(),
  predictedWinnerId: z.string().nullable().optional(),
  predictedHomeScore: z.number().optional(),
  predictedAwayScore: z.number().optional(),
  predictionRationale: z.string().optional(),
});

// Schema for batch updating matchup predictions
const batchUpdateMatchupPredictionsSchema = z.object({
  leagueSlug: z.string().min(1),
  weekNumber: z.number().int().positive(),
  predictions: z.array(predictionUpdateSchema),
});

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
    predictions: Array<{
      id: string;
      isFeatured: boolean;
      hypeText: string | null;
      predictedWinnerId: string;
    }>;
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
      projectedScore: matchup.homeTeamProjected
        ? Number(matchup.homeTeamProjected)
        : undefined,
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
      projectedScore: matchup.awayTeamProjected
        ? Number(matchup.awayTeamProjected)
        : undefined,
    },
    isFeatured: prediction?.isFeatured ?? false,
    hypeText: prediction?.hypeText ?? '',
    predictedWinnerId: prediction?.predictedWinnerId ?? undefined,
    lastSaved: new Date().toISOString(),
  };
}

/**
 * Fetch all matchup predictions for a week with related data
 */
async function fetchMatchupPredictionsData(
  leagueId: string,
  leagueSlug: string,
  weekNumber: number,
  season: number
): Promise<MatchupPredictionsData> {
  const matchups = await prisma.matchup.findMany({
    where: {
      leagueId,
      weekNumber,
      season,
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

/**
 * Update Matchup Prediction Server Action
 *
 * Replaces mock implementation with Prisma for commissioner desk.
 * - Validates user has commissioner role
 * - Upserts MatchupPrediction record for the matchup
 * - Stores predictedWinnerId and hypeText
 * - Returns updated MatchupPredictionsData
 */
export const updateMatchupPredictionAction = authActionClient
  .schema(updateMatchupPredictionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const {
      leagueSlug,
      weekNumber,
      matchupId,
      isFeatured,
      hypeText,
      predictedWinnerId,
    } = parsedInput;
    const { userId } = ctx;

    // Get the league by slug
    const league = await prisma.league.findUnique({
      where: { slug: leagueSlug },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Validate commissioner role
    await requireCommissioner(userId, league.id);

    // Get the matchup to verify it exists and get season
    const matchup = await prisma.matchup.findFirst({
      where: {
        id: matchupId,
        leagueId: league.id,
        weekNumber,
      },
      select: {
        id: true,
        season: true,
        leagueId: true,
        weekNumber: true,
        homeTeamId: true,
      },
    });

    if (!matchup) {
      throw new Error('Matchup not found');
    }

    // If setting isFeatured to true, unfeature all others first
    if (isFeatured === true) {
      await prisma.matchupPrediction.updateMany({
        where: {
          leagueId: league.id,
          weekNumber,
          season: matchup.season,
          isFeatured: true,
        },
        data: {
          isFeatured: false,
        },
      });
    }

    // Upsert the prediction using matchupId as unique identifier
    await prisma.matchupPrediction.upsert({
      where: {
        matchupId,
      },
      create: {
        matchupId,
        leagueId: league.id,
        season: matchup.season,
        weekNumber,
        predictedWinnerId: predictedWinnerId ?? matchup.homeTeamId, // Use home team as placeholder if none
        isFeatured: isFeatured ?? false,
        hypeText: hypeText ?? null,
        status: 'draft',
      },
      update: {
        ...(isFeatured !== undefined && { isFeatured }),
        ...(hypeText !== undefined && { hypeText }),
        ...(predictedWinnerId !== undefined && {
          predictedWinnerId: predictedWinnerId ?? undefined,
        }),
        updatedAt: new Date(),
      },
    });

    // Revalidate cache
    revalidatePath(`/leagues/${leagueSlug}/desk`);

    // Return updated predictions data
    return fetchMatchupPredictionsData(league.id, leagueSlug, weekNumber, matchup.season);
  });

/**
 * Batch Update Matchup Predictions Server Action
 *
 * Updates multiple predictions at once.
 * - Validates user has commissioner role
 * - Upserts all MatchupPrediction records
 * - Returns updated MatchupPredictionsData
 */
export const batchUpdateMatchupPredictionsAction = authActionClient
  .schema(batchUpdateMatchupPredictionsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { leagueSlug, weekNumber, predictions } = parsedInput;
    const { userId } = ctx;

    // Get the league by slug
    const league = await prisma.league.findUnique({
      where: { slug: leagueSlug },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Validate commissioner role
    await requireCommissioner(userId, league.id);

    // Get all matchups to verify they exist and get season
    const matchupIds = predictions.map((p) => p.matchupId);
    const matchups = await prisma.matchup.findMany({
      where: {
        id: { in: matchupIds },
        leagueId: league.id,
        weekNumber,
      },
      select: {
        id: true,
        season: true,
        homeTeamId: true,
      },
    });

    if (matchups.length === 0) {
      throw new Error('No valid matchups found');
    }

    const season = matchups[0]?.season;
    if (!season) {
      throw new Error('Season not found for matchups');
    }

    // Build a map of matchupId -> homeTeamId for placeholder winner
    const matchupMap = new Map(matchups.map((m) => [m.id, m.homeTeamId]));

    // Find which prediction should be featured (only one allowed)
    const featuredUpdate = predictions.find((p) => p.isFeatured === true);

    // If a prediction is being featured, unfeature all others
    if (featuredUpdate) {
      await prisma.matchupPrediction.updateMany({
        where: {
          leagueId: league.id,
          weekNumber,
          season,
          isFeatured: true,
        },
        data: {
          isFeatured: false,
        },
      });
    }

    // Process each prediction update
    for (const prediction of predictions) {
      const homeTeamId = matchupMap.get(prediction.matchupId);
      if (!homeTeamId) {
        continue; // Skip invalid matchup IDs
      }

      await prisma.matchupPrediction.upsert({
        where: {
          matchupId: prediction.matchupId,
        },
        create: {
          matchupId: prediction.matchupId,
          leagueId: league.id,
          season,
          weekNumber,
          predictedWinnerId: prediction.predictedWinnerId ?? homeTeamId, // Use home team as placeholder
          isFeatured: prediction.isFeatured ?? false,
          hypeText: prediction.hypeText ?? null,
          status: 'draft',
        },
        update: {
          ...(prediction.isFeatured !== undefined && {
            isFeatured: prediction.isFeatured,
          }),
          ...(prediction.hypeText !== undefined && {
            hypeText: prediction.hypeText,
          }),
          ...(prediction.predictedWinnerId !== undefined && {
            predictedWinnerId: prediction.predictedWinnerId ?? undefined,
          }),
          updatedAt: new Date(),
        },
      });
    }

    // Revalidate cache
    revalidatePath(`/leagues/${leagueSlug}/desk`);

    // Return updated predictions data
    return fetchMatchupPredictionsData(league.id, leagueSlug, weekNumber, season);
  });
