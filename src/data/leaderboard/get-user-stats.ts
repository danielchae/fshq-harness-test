// Data layer for user stats
// Queries pick'ems stats for specific league using Prisma

import { unstable_cache } from 'next/cache';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import type { UserStats } from '@/types/leaderboard';

export interface GetUserStatsInput {
  leagueSlug: string;
  userId?: string; // If not provided, uses current authenticated user
}

/**
 * Default stats for users with no picks
 */
const DEFAULT_USER_STATS: UserStats = {
  record: { wins: 0, losses: 0 },
  accuracy: 0,
  leagueAverage: 0,
  isAboveAverage: false,
  hasNoPicks: true,
};

/**
 * Internal function to fetch user stats from database
 */
async function fetchUserStats(leagueSlug: string, userId: string): Promise<UserStats> {
  // First, get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  if (!league) {
    return DEFAULT_USER_STATS;
  }

  const currentYear = new Date().getFullYear();

  // Fetch user's season stats and all league stats for ranking in parallel
  const [userSeasonStats, allLeagueStats, userMembership, previousWeekStats, currentWeekStats] = await Promise.all([
    // User's season stats in this league
    prisma.seasonStats.findFirst({
      where: {
        userId,
        leagueId: league.id,
        season: currentYear,
      },
      select: {
        totalPicks: true,
        correctPicks: true,
        accuracy: true,
        currentStreak: true,
        longestStreak: true,
      },
    }),
    // All users' season stats in this league for ranking and average calculation
    prisma.seasonStats.findMany({
      where: {
        leagueId: league.id,
        season: currentYear,
        totalPicks: { gt: 0 }, // Only include users who have made picks
      },
      select: {
        userId: true,
        correctPicks: true,
        accuracy: true,
        user: {
          select: {
            memberships: {
              where: { leagueId: league.id },
              select: { role: true },
            },
          },
        },
      },
      orderBy: { correctPicks: 'desc' },
    }),
    // User's membership to get their role
    prisma.leagueMembership.findFirst({
      where: {
        userId,
        leagueId: league.id,
      },
      select: { role: true },
    }),
    // User's previous week stats for improvement calculation
    prisma.weeklyStats.findFirst({
      where: {
        userId,
        leagueId: league.id,
        season: currentYear,
      },
      orderBy: { weekNumber: 'desc' },
      skip: 1, // Get second most recent (previous week)
      select: {
        accuracy: true,
        weekNumber: true,
      },
    }),
    // User's current week stats
    prisma.weeklyStats.findFirst({
      where: {
        userId,
        leagueId: league.id,
        season: currentYear,
      },
      orderBy: { weekNumber: 'desc' },
      select: {
        accuracy: true,
        weekNumber: true,
      },
    }),
  ]);

  // If user has no stats, return default with hasNoPicks = true
  if (!userSeasonStats || userSeasonStats.totalPicks === 0) {
    // Calculate league average even if user has no picks
    const leagueAverage =
      allLeagueStats.length > 0
        ? Math.round((allLeagueStats.reduce((sum, s) => sum + s.accuracy, 0) / allLeagueStats.length) * 10) / 10
        : 0;

    return {
      ...DEFAULT_USER_STATS,
      leagueAverage,
    };
  }

  // Calculate user stats
  const wins = userSeasonStats.correctPicks;
  const losses = userSeasonStats.totalPicks - userSeasonStats.correctPicks;
  const accuracy = Math.round(userSeasonStats.accuracy * 1000) / 10; // Convert to percentage with 1 decimal

  // Calculate league average accuracy
  const leagueAverage =
    allLeagueStats.length > 0
      ? Math.round((allLeagueStats.reduce((sum, s) => sum + s.accuracy, 0) / allLeagueStats.length) * 1000) / 10
      : 0;

  const isAboveAverage = accuracy > leagueAverage;

  // Calculate overall rank
  const overallRank = allLeagueStats.findIndex((s) => s.userId === userId) + 1;
  const totalParticipants = allLeagueStats.length;

  // Calculate role-specific rank
  let roleSpecificRank: { rank: number; total: number; role: 'manager' | 'fan' } | undefined;

  if (userMembership) {
    // Determine role category - managers and commissioners compete separately from fans
    const userRoleCategory = ['manager', 'commissioner', 'admin'].includes(userMembership.role) ? 'manager' : 'fan';

    // Filter users by same role category
    const roleFilteredStats = allLeagueStats.filter((s) => {
      const memberRole = s.user.memberships[0]?.role;
      const isManagerCategory = ['manager', 'commissioner', 'admin'].includes(memberRole || '');
      return userRoleCategory === 'manager' ? isManagerCategory : !isManagerCategory;
    });

    const roleRank = roleFilteredStats.findIndex((s) => s.userId === userId) + 1;

    if (roleRank > 0) {
      roleSpecificRank = {
        rank: roleRank,
        total: roleFilteredStats.length,
        role: userRoleCategory as 'manager' | 'fan',
      };
    }
  }

  // Build rank object
  const rank: UserStats['rank'] =
    overallRank > 0
      ? {
          overall: overallRank,
          totalParticipants,
          roleSpecific: roleSpecificRank,
        }
      : undefined;

  return {
    record: {
      wins,
      losses,
    },
    accuracy,
    leagueAverage,
    isAboveAverage,
    rank,
    hasNoPicks: false,
  };
}

/**
 * Cached user stats fetcher
 * Uses unstable_cache with tag: user-stats-{leagueSlug}-{userId}
 */
const getCachedUserStats = (leagueSlug: string, userId: string) =>
  unstable_cache(async () => fetchUserStats(leagueSlug, userId), [`user-stats-${leagueSlug}-${userId}`], {
    tags: [`user-stats-${leagueSlug}-${userId}`, `user-stats-${leagueSlug}`, `leaderboard-${leagueSlug}`],
    revalidate: 60, // Cache for 1 minute - leaderboard data should be relatively fresh
  });

/**
 * Get user stats for a specific league
 * Queries pick'ems stats including accuracy, streak, and rank
 * Calculates improvement from previous week
 * Returns UserStats with performance data
 */
export async function getUserStats(input: GetUserStatsInput): Promise<UserStats> {
  const { leagueSlug, userId } = input;

  // Get userId from session if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const session = await auth();
    resolvedUserId = session?.user?.id;
  }

  if (!resolvedUserId) {
    return DEFAULT_USER_STATS;
  }

  return getCachedUserStats(leagueSlug, resolvedUserId)();
}
