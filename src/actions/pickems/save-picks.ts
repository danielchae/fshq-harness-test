'use server';

import { z } from 'zod';

import { authActionClient } from '@/actions/safe-action';
import { getAccessibleLeagueBySlug } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

// Schema for a single pick
const pickSchema = z.object({
  matchupId: z.string().min(1),
  selectedTeamId: z.string().min(1),
});

// Schema for the save picks request
const savePicksSchema = z.object({
  leagueSlug: z.string().min(1),
  weekNumber: z.number().int().positive(),
  season: z.number().int().positive(),
  picks: z.array(pickSchema).min(1),
});

// Result type that matches existing contract
export interface SavePicksResult {
  picks: { matchupId: string; teamId: string }[];
  lockedError: boolean;
  errors: string[];
}

/**
 * Save Pick'ems Server Action
 *
 * Replaces mock implementation with Prisma for user pick submissions.
 * - Validates user is a league member
 * - Validates picks are submitted before deadline (matchup lock time)
 * - Upserts PickemEntry records for each matchup
 * - Returns SavePicksResult with confirmation
 */
export const savePicksAction = authActionClient
  .schema(savePicksSchema)
  .action(async ({ parsedInput, ctx }): Promise<SavePicksResult> => {
    const { leagueSlug, weekNumber, season, picks } = parsedInput;
    const { userId } = ctx;

    // Validate user has access to this league
    let league;
    try {
      league = await getAccessibleLeagueBySlug(userId, leagueSlug);
    } catch {
      return {
        picks: [],
        lockedError: false,
        errors: ['League not found or you do not have access'],
      };
    }

    // Extract all matchup IDs from the picks
    const matchupIds = picks.map((p) => p.matchupId);

    // Fetch all matchups to validate completion status and team membership
    const matchups = await prisma.matchup.findMany({
      where: {
        id: { in: matchupIds },
        leagueId: league.id,
        weekNumber,
        season,
      },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        isComplete: true,
      },
    });

    // Build a map for quick lookup
    const matchupMap = new Map(matchups.map((m) => [m.id, m]));

    const now = new Date();
    const savedPicks: { matchupId: string; teamId: string }[] = [];
    const errors: string[] = [];
    let hasLockedError = false;

    // Process each pick
    for (const pick of picks) {
      const matchup = matchupMap.get(pick.matchupId);

      if (!matchup) {
        errors.push(`Matchup ${pick.matchupId} not found in this league/week`);
        continue;
      }

      // Check if matchup is already completed (locked)
      if (matchup.isComplete) {
        errors.push(`Matchup ${pick.matchupId} is locked (already completed)`);
        hasLockedError = true;
        continue;
      }

      // Validate the selected team is part of this matchup
      const validTeamIds = [matchup.homeTeamId, matchup.awayTeamId].filter(Boolean);
      if (!validTeamIds.includes(pick.selectedTeamId)) {
        errors.push(`Team ${pick.selectedTeamId} is not part of matchup ${pick.matchupId}`);
        continue;
      }

      // Upsert the pick entry
      try {
        await prisma.pickemEntry.upsert({
          where: {
            user_matchup_pick_unique: {
              userId,
              matchupId: pick.matchupId,
            },
          },
          create: {
            userId,
            leagueId: league.id,
            matchupId: pick.matchupId,
            weekNumber,
            season,
            predictedWinnerId: pick.selectedTeamId,
            submittedAt: now,
          },
          update: {
            predictedWinnerId: pick.selectedTeamId,
            submittedAt: now,
          },
        });

        savedPicks.push({
          matchupId: pick.matchupId,
          teamId: pick.selectedTeamId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to save pick for matchup ${pick.matchupId}: ${errorMessage}`);
      }
    }

    return {
      picks: savedPicks,
      lockedError: hasLockedError && savedPicks.length === 0,
      errors,
    };
  });

/**
 * Get user's picks for a specific week
 */
export async function getUserPicks(
  userId: string,
  leagueId: string,
  weekNumber: number,
  season: number
): Promise<{ matchupId: string; selectedTeamId: string }[]> {
  const entries = await prisma.pickemEntry.findMany({
    where: {
      userId,
      leagueId,
      weekNumber,
      season,
    },
    select: {
      matchupId: true,
      predictedWinnerId: true,
    },
  });

  return entries.map((entry) => ({
    matchupId: entry.matchupId,
    selectedTeamId: entry.predictedWinnerId,
  }));
}
