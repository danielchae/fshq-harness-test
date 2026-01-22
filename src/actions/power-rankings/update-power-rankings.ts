'use server';

import { z } from 'zod';

import { authActionClient } from '@/actions/safe-action';
import { requireCommissioner } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

import type { PowerRankingsData, TeamRanking } from '@/data/fixtures/power-rankings';

// Schema for a single team ranking update
const teamRankingSchema = z.object({
  teamId: z.string().min(1),
  rank: z.number().int().positive(),
  commentary: z.string().optional(),
});

// Schema for the full update request
const updatePowerRankingsSchema = z.object({
  leagueSlug: z.string().min(1),
  weekNumber: z.number().int().positive(),
  season: z.number().int().positive(),
  rankings: z.array(teamRankingSchema).min(1),
});

// Schema for updating a single team's commentary
const updateTeamCommentarySchema = z.object({
  leagueSlug: z.string().min(1),
  weekNumber: z.number().int().positive(),
  season: z.number().int().positive(),
  teamId: z.string().min(1),
  commentary: z.string(),
});

/**
 * Get previous week's rankings for movement calculation
 */
async function getPreviousWeekRankings(
  leagueId: string,
  season: number,
  weekNumber: number
): Promise<Map<string, number>> {
  const previousRankings = new Map<string, number>();

  if (weekNumber <= 1) {
    return previousRankings;
  }

  const previousPowerRanking = await prisma.powerRanking.findUnique({
    where: {
      league_season_week_unique: {
        leagueId,
        season,
        weekNumber: weekNumber - 1,
      },
    },
    include: {
      entries: {
        select: {
          teamId: true,
          rank: true,
        },
      },
    },
  });

  if (previousPowerRanking) {
    for (const entry of previousPowerRanking.entries) {
      previousRankings.set(entry.teamId, entry.rank);
    }
  }

  return previousRankings;
}

/**
 * Calculate movement between previous and current rank
 * Positive = moved up, Negative = moved down
 */
function calculateMovement(previousRank: number | null, currentRank: number): number {
  if (previousRank === null) {
    return 0;
  }
  // Moving from rank 5 to rank 2 = moved up 3 positions (positive)
  // Moving from rank 2 to rank 5 = moved down 3 positions (negative)
  return previousRank - currentRank;
}

/**
 * Update Power Rankings Server Action
 *
 * Replaces mock implementation with Prisma for commissioner desk.
 * - Validates user has commissioner role
 * - Upserts PowerRankings records for each team
 * - Calculates movement from previous week
 * - Returns updated PowerRankingsData
 */
export const updatePowerRankingsAction = authActionClient
  .schema(updatePowerRankingsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { leagueSlug, weekNumber, season, rankings } = parsedInput;
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

    // Get previous week's rankings for movement calculation
    const previousRankings = await getPreviousWeekRankings(league.id, season, weekNumber);

    // Upsert the parent PowerRanking record
    const powerRanking = await prisma.powerRanking.upsert({
      where: {
        league_season_week_unique: {
          leagueId: league.id,
          season,
          weekNumber,
        },
      },
      create: {
        leagueId: league.id,
        season,
        weekNumber,
        status: 'draft',
      },
      update: {
        updatedAt: new Date(),
      },
    });

    // Delete existing entries to handle rank changes properly
    // (can't update rank with unique constraint without this)
    await prisma.powerRankingEntry.deleteMany({
      where: { powerRankingId: powerRanking.id },
    });

    // Create new ranking entries with movement calculation
    const entries = await Promise.all(
      rankings.map(async (ranking) => {
        const previousRank = previousRankings.get(ranking.teamId) ?? null;
        const movement = calculateMovement(previousRank, ranking.rank);

        return prisma.powerRankingEntry.create({
          data: {
            powerRankingId: powerRanking.id,
            teamId: ranking.teamId,
            rank: ranking.rank,
            previousRank,
            movement,
            commentary: ranking.commentary ?? null,
          },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                ownerUsername: true,
                wins: true,
                losses: true,
                ties: true,
              },
            },
          },
        });
      })
    );

    // Sort entries by rank for consistent output
    entries.sort((a, b) => a.rank - b.rank);

    // Build the PowerRankingsData response
    const teamRankings: TeamRanking[] = entries.map((entry) => ({
      id: entry.id,
      teamId: entry.teamId,
      teamName: entry.team.name,
      ownerUsername: entry.team.ownerUsername ?? '',
      record: {
        wins: entry.team.wins,
        losses: entry.team.losses,
        ties: entry.team.ties,
      },
      rank: entry.rank,
      previousRank: entry.previousRank ?? undefined,
      commentary: entry.commentary ?? '',
    }));

    const result: PowerRankingsData = {
      id: powerRanking.id,
      leagueSlug,
      seasonId: `season-${season}`,
      weekNumber,
      rankings: teamRankings,
      status: powerRanking.status,
      lastSaved: powerRanking.updatedAt.toISOString(),
      publishedAt: powerRanking.publishedAt?.toISOString(),
    };

    return result;
  });

/**
 * Update Team Commentary Server Action
 *
 * Updates commentary for a single team in the power rankings.
 * - Validates user has commissioner role
 * - Updates the specific team's commentary
 * - Returns updated PowerRankingsData
 */
export const updateTeamCommentaryAction = authActionClient
  .schema(updateTeamCommentarySchema)
  .action(async ({ parsedInput, ctx }) => {
    const { leagueSlug, weekNumber, season, teamId, commentary } = parsedInput;
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

    // Find the power ranking for this week
    const powerRanking = await prisma.powerRanking.findUnique({
      where: {
        league_season_week_unique: {
          leagueId: league.id,
          season,
          weekNumber,
        },
      },
    });

    if (!powerRanking) {
      throw new Error('Power ranking not found for this week');
    }

    // Update the specific team's commentary
    await prisma.powerRankingEntry.update({
      where: {
        power_ranking_team_unique: {
          powerRankingId: powerRanking.id,
          teamId,
        },
      },
      data: {
        commentary,
      },
    });

    // Fetch updated entries with team data
    const entries = await prisma.powerRankingEntry.findMany({
      where: { powerRankingId: powerRanking.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            ownerUsername: true,
            wins: true,
            losses: true,
            ties: true,
          },
        },
      },
      orderBy: { rank: 'asc' },
    });

    // Build the PowerRankingsData response
    const teamRankings: TeamRanking[] = entries.map((entry) => ({
      id: entry.id,
      teamId: entry.teamId,
      teamName: entry.team.name,
      ownerUsername: entry.team.ownerUsername ?? '',
      record: {
        wins: entry.team.wins,
        losses: entry.team.losses,
        ties: entry.team.ties,
      },
      rank: entry.rank,
      previousRank: entry.previousRank ?? undefined,
      commentary: entry.commentary ?? '',
    }));

    const result: PowerRankingsData = {
      id: powerRanking.id,
      leagueSlug,
      seasonId: `season-${season}`,
      weekNumber,
      rankings: teamRankings,
      status: powerRanking.status,
      lastSaved: new Date().toISOString(),
      publishedAt: powerRanking.publishedAt?.toISOString(),
    };

    return result;
  });
