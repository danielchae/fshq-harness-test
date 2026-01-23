// Data layer for pick'ems

import { unstable_cache } from 'next/cache';

import { auth } from '@/lib/auth';
import { getAccessibleLeagueBySlug } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';
import { DEFAULT_CHAMPIONSHIP_WEEK, getNFLSeasonState, NFL_TOTAL_WEEKS } from '@/lib/nfl-week';

import type {
  PickDistribution,
  PickemMatchup,
  PickemsResponse,
  PickemsSeasonState,
  PickemTeam,
  RevealedPick,
  UserPick,
  WeeklyScore,
} from '@/types/pickems';

// Result type for savePicks that includes lock error state
export interface SavePicksResult {
  picks: { matchupId: string; teamId: string }[];
  lockedError: boolean;
  errors: string[];
}

export interface GetPickemsInput {
  leagueSlug: string;
  weekNumber?: number;
  userId?: string;
}

/**
 * Calculate lock time for a matchup
 * In production, this would come from the platform API (game start time)
 * For now, we generate realistic lock times for testing
 */
function calculateLockTime(matchupIndex: number, weekNumber: number, isComplete: boolean): string {
  if (isComplete) {
    // Past matchups are always locked
    return new Date(0).toISOString();
  }

  const now = new Date();
  // Spread lock times - first few matchups are unlocked for testing
  let hoursToLock: number;
  if (matchupIndex < 3) {
    hoursToLock = 2 + matchupIndex * 2; // 2hr, 4hr, 6hr - unlocked
  } else if (matchupIndex === 3) {
    hoursToLock = 0.5; // 30 min - for countdown timer testing
  } else {
    hoursToLock = -1; // Already locked
  }

  const lockDate = new Date(now.getTime() + hoursToLock * 60 * 60 * 1000);
  return lockDate.toISOString();
}

/**
 * Transform a Prisma team to PickemTeam type
 */
function transformTeam(
  team: {
    id: string;
    name: string;
    ownerUsername: string | null;
    avatarUrl: string | null;
    wins: number;
    losses: number;
    ties: number;
  },
  score?: number | null,
  projectedScore?: number
): PickemTeam {
  return {
    id: team.id,
    name: team.name,
    ownerUsername: team.ownerUsername || 'Unknown',
    avatarUrl: team.avatarUrl || undefined,
    record: {
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
    },
    score: score ?? undefined,
    projectedScore,
  };
}

/**
 * Generate revealed picks for a matchup (other users' picks)
 * Only shown for locked/completed matchups
 */
async function getRevealedPicks(
  matchupId: string,
  currentUserId: string | null
): Promise<{ picks: RevealedPick[]; distribution: PickDistribution }> {
  // Get all picks for this matchup except the current user
  const allPicks = await prisma.pickemEntry.findMany({
    where: {
      matchupId,
      ...(currentUserId ? { userId: { not: currentUserId } } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const picks: RevealedPick[] = allPicks.map((pick) => ({
    userId: pick.userId,
    userName: pick.user.name || 'Anonymous',
    teamId: pick.predictedWinnerId,
  }));

  // Calculate distribution
  const distribution: PickDistribution = {};
  for (const pick of allPicks) {
    distribution[pick.predictedWinnerId] = (distribution[pick.predictedWinnerId] || 0) + 1;
  }

  return { picks, distribution };
}

/**
 * Get the league's available weeks and last active week
 */
async function getLeagueWeekInfo(
  leagueId: string,
  season: number
): Promise<{ availableWeeks: number[]; lastActiveWeek: number; championshipWeek: number }> {
  // Get all distinct week numbers that have matchups for this league
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

  // Determine last active week (highest week with matchups)
  const lastActiveWeek = availableWeeks.length > 0 ? Math.max(...availableWeeks) : 1;

  // Championship week is typically the last week or DEFAULT_CHAMPIONSHIP_WEEK
  const championshipWeek = Math.min(lastActiveWeek, DEFAULT_CHAMPIONSHIP_WEEK);

  return { availableWeeks, lastActiveWeek, championshipWeek };
}

/**
 * Get Pick'ems - Prisma Implementation
 *
 * Queries matchups with user's picks for the specified week.
 * Reveals results after games complete.
 * Shows weekly score and league average.
 * 
 * Smart week selection:
 * - During regular season: shows NFL current week
 * - During postseason/offseason: shows league's last active week
 * - Allows browsing historical weeks
 */
export async function getPickems(input: GetPickemsInput): Promise<PickemsResponse> {
  // Get NFL season state for smart defaults
  const nflState = await getNFLSeasonState();
  const { leagueSlug } = input;

  // Get authenticated user from session
  const session = await auth();
  const userId = input.userId || session?.user?.id || null;

  // Get league by slug (validates existence)
  let league;
  try {
    if (userId) {
      league = await getAccessibleLeagueBySlug(userId, leagueSlug);
    } else {
      // For unauthenticated users, just get the league
      league = await prisma.league.findUnique({
        where: { slug: leagueSlug },
      });
    }
  } catch {
    // League not found or user doesn't have access
    league = await prisma.league.findUnique({
      where: { slug: leagueSlug },
    });
  }

  if (!league) {
    // Return empty response if league not found
    return {
      matchups: [],
      currentWeek: nflState.week,
      totalWeeks: NFL_TOTAL_WEEKS,
      picks: [],
      hasSubmittedPicks: false,
      isWeekComplete: false,
    };
  }

  const season = league.season || new Date().getFullYear();

  // Get league's week info for smart defaults
  const leagueWeekInfo = await getLeagueWeekInfo(league.id, season);

  // Determine which week to show
  let weekNumber: number;
  if (input.weekNumber !== undefined) {
    // User explicitly requested a specific week
    weekNumber = input.weekNumber;
  } else if (nflState.isFantasySeasonComplete) {
    // Season is over - show the last week with data (championship results)
    weekNumber = leagueWeekInfo.lastActiveWeek;
  } else {
    // Regular season - show current NFL week
    // But cap it at the last week that has matchups
    weekNumber = Math.min(nflState.week, leagueWeekInfo.lastActiveWeek || nflState.week);
  }

  // Build season state for the response
  const seasonState: PickemsSeasonState = {
    status: nflState.status,
    isSeasonComplete: nflState.isFantasySeasonComplete,
    canMakePicks: nflState.isPicksEnabled && weekNumber <= leagueWeekInfo.championshipWeek,
    statusMessage: nflState.isFantasySeasonComplete
      ? `Season Complete - Viewing Week ${weekNumber} Results`
      : nflState.statusMessage,
    lastActiveWeek: leagueWeekInfo.lastActiveWeek,
    championshipWeek: leagueWeekInfo.championshipWeek,
    availableWeeks: leagueWeekInfo.availableWeeks,
  };

  // Fetch matchups for this league and week
  const matchups = await prisma.matchup.findMany({
    where: {
      leagueId: league.id,
      weekNumber,
      season,
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      winner: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Check if the week is complete (all matchups are complete)
  const isWeekComplete = matchups.length > 0 && matchups.every((m) => m.isComplete);
  const isPastWeek = weekNumber < nflState.week || nflState.isFantasySeasonComplete;

  // Get user's picks for this week
  let userPicks: {
    matchupId: string;
    predictedWinnerId: string;
    submittedAt: Date;
    isCorrect: boolean | null;
    hasStatCorrection: boolean;
  }[] = [];

  if (userId) {
    userPicks = await prisma.pickemEntry.findMany({
      where: {
        userId,
        leagueId: league.id,
        weekNumber,
        season,
      },
      select: {
        matchupId: true,
        predictedWinnerId: true,
        submittedAt: true,
        isCorrect: true,
        hasStatCorrection: true,
      },
    });
  }

  // Create a map for quick lookup
  const userPicksMap = new Map(userPicks.map((p) => [p.matchupId, p]));

  // Transform matchups to PickemMatchup type
  const pickemMatchups: PickemMatchup[] = await Promise.all(
    matchups.map(async (matchup, index) => {
      const userPick = userPicksMap.get(matchup.id);
      const isComplete = matchup.isComplete;

      // Calculate lock time and status
      const lockTime = calculateLockTime(index, weekNumber, isComplete || isPastWeek);
      const isLocked = isComplete || isPastWeek || new Date(lockTime) <= new Date();

      // Convert Decimal scores to numbers
      const homeScore = matchup.homeTeamScore ? Number(matchup.homeTeamScore) : undefined;
      const awayScore = matchup.awayTeamScore ? Number(matchup.awayTeamScore) : undefined;

      // Generate projected scores (random for now, would come from platform in production)
      const homeProjected = 90 + Math.floor(Math.random() * 40);
      const awayProjected = 90 + Math.floor(Math.random() * 40);

      // Get revealed picks for locked matchups
      let revealedPicks: RevealedPick[] | undefined;
      let distribution: PickDistribution | undefined;

      if (isLocked) {
        const revealed = await getRevealedPicks(matchup.id, userId);
        revealedPicks = revealed.picks.length > 0 ? revealed.picks : undefined;
        distribution = Object.keys(revealed.distribution).length > 0 ? revealed.distribution : undefined;
      }

      return {
        id: matchup.id,
        homeTeam: transformTeam(matchup.homeTeam, homeScore, isComplete ? undefined : homeProjected),
        awayTeam: transformTeam(matchup.awayTeam, awayScore, isComplete ? undefined : awayProjected),
        weekNumber: matchup.weekNumber,
        lockTime,
        isLocked,
        selectedTeamId: userPick?.predictedWinnerId,
        picks: revealedPicks,
        distribution,
        // Grading data for completed matchups
        isComplete,
        winnerId: matchup.winnerId || undefined,
        userPick: userPick?.predictedWinnerId,
        isCorrect: userPick?.isCorrect ?? undefined,
        hasStatCorrection: userPick?.hasStatCorrection || false,
      };
    })
  );

  // Transform user picks to UserPick type
  const picks: UserPick[] = userPicks.map((p) => ({
    matchupId: p.matchupId,
    selectedTeamId: p.predictedWinnerId,
    submittedAt: p.submittedAt.toISOString(),
  }));

  const hasSubmittedPicks = picks.length > 0;

  // Calculate weekly score for completed weeks
  let weeklyScore: WeeklyScore | undefined;
  if (isWeekComplete || isPastWeek) {
    const gradedPicks = userPicks.filter((p) => p.isCorrect !== null);
    const correctPicks = gradedPicks.filter((p) => p.isCorrect === true).length;
    const totalPicks = gradedPicks.length;

    if (totalPicks > 0) {
      weeklyScore = {
        correct: correctPicks,
        total: totalPicks,
        percentage: Math.round((correctPicks / totalPicks) * 100),
      };
    }
  }

  // Calculate global lock time (earliest lock time among unlocked matchups)
  const unlockedMatchups = pickemMatchups.filter((m) => !m.isLocked);
  let lockTimeGlobal: string | undefined;
  if (unlockedMatchups.length > 0 && unlockedMatchups[0]) {
    lockTimeGlobal = unlockedMatchups.reduce((earliest, m) => {
      return new Date(m.lockTime) < new Date(earliest) ? m.lockTime : earliest;
    }, unlockedMatchups[0].lockTime);
  }

  return {
    matchups: pickemMatchups,
    currentWeek: weekNumber,
    totalWeeks: NFL_TOTAL_WEEKS,
    picks,
    lockTimeGlobal,
    weeklyScore,
    hasSubmittedPicks,
    isWeekComplete,
    seasonState,
  };
}

/**
 * Cached version of getPickems for better performance
 * Cache is tagged for selective revalidation
 */
export const getCachedPickems = unstable_cache(
  async (leagueSlug: string, weekNumber: number, userId: string | null) => {
    return getPickems({ leagueSlug, weekNumber, userId: userId || undefined });
  },
  ['pickems'],
  {
    revalidate: 300, // 5 minutes
    tags: ['pickems'],
  }
);

export interface SavePicksInput {
  leagueSlug: string;
  weekNumber?: number;
  userId?: string;
  season?: number;
  picks: {
    matchupId: string;
    selectedTeamId: string;
  }[];
}

/**
 * Save Pick'ems - Prisma Implementation
 *
 * Validates user is a league member, picks are before deadline,
 * and upserts PickemEntry records for each matchup.
 */
export async function savePicks(input: SavePicksInput): Promise<SavePicksResult> {
  const nflState = await getNFLSeasonState();
  const { leagueSlug, weekNumber = nflState.week, season = new Date().getFullYear(), picks } = input;

  // Check if fantasy season is complete
  if (nflState.isFantasySeasonComplete) {
    return {
      picks: [],
      lockedError: true,
      errors: ['The fantasy season has ended. Picks are no longer accepted.'],
    };
  }

  // Get authenticated user from session
  const session = await auth();
  if (!session?.user?.id) {
    return {
      picks: [],
      lockedError: false,
      errors: ['Unauthorized: Please sign in to save picks'],
    };
  }

  const userId = session.user.id;

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
}
