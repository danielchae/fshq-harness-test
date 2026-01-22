// Data layer for leaderboard
// Implements Pick'ems Leaderboard Data Fetcher (task-35)

import { unstable_cache } from 'next/cache';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentNFLWeek } from '@/lib/nfl-week';

import type {
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardRoleFilter,
  LeaderboardScope,
} from '@/types/leaderboard';

// Constants
const DEFAULT_CURRENT_SEASON = 2025;

export interface GetLeaderboardInput {
  leagueSlug: string;
  scope?: LeaderboardScope;
  roleFilter?: LeaderboardRoleFilter;
  weekNumber?: number; // Only for weekly scope
}

/**
 * Calculate league average accuracy from standings
 */
function calculateLeagueAverage(standings: LeaderboardEntry[]): number {
  if (standings.length === 0) return 0;
  const totalAccuracy = standings.reduce((sum, entry) => sum + entry.accuracy, 0);
  return Math.round(totalAccuracy / standings.length);
}

/**
 * Maps Prisma MembershipRole to frontend role type
 */
function mapRole(role: string): 'commissioner' | 'admin' | 'manager' | 'fan' {
  switch (role) {
    case 'commissioner':
      return 'commissioner';
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'fan':
    default:
      return 'fan';
  }
}

/**
 * Fetches season leaderboard stats from database
 */
async function fetchSeasonLeaderboard(
  leagueId: string,
  season: number,
  currentUserId: string | undefined,
  roleFilter: LeaderboardRoleFilter
): Promise<LeaderboardEntry[]> {
  // Query SeasonStats with user and membership data
  const stats = await prisma.seasonStats.findMany({
    where: {
      leagueId,
      season,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          image: true,
        },
      },
    },
    orderBy: {
      correctPicks: 'desc',
    },
  });

  // Get memberships to determine roles and team names
  const memberships = await prisma.leagueMembership.findMany({
    where: {
      leagueId,
      status: 'approved',
      userId: {
        in: stats.map((s) => s.userId),
      },
    },
    include: {
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  // Create a map of userId to membership data
  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));

  // Transform stats to LeaderboardEntry
  let entries: LeaderboardEntry[] = stats.map((stat) => {
    const membership = membershipMap.get(stat.userId);
    const role = mapRole(membership?.role || 'fan');
    const wins = stat.correctPicks;
    const losses = stat.totalPicks - stat.correctPicks;

    return {
      id: stat.id,
      rank: 0, // Will be set after filtering
      userId: stat.userId,
      username: stat.user.username || stat.user.name || 'Unknown',
      avatarUrl: stat.user.avatarUrl || stat.user.image || undefined,
      teamName: membership?.team?.name || undefined,
      role,
      wins,
      losses,
      totalPicks: stat.totalPicks,
      accuracy: Math.round(stat.accuracy),
      isCurrentUser: stat.userId === currentUserId,
    };
  });

  // Apply role filter
  if (roleFilter !== 'all') {
    if (roleFilter === 'manager') {
      // Managers include commissioner, admin, and manager roles
      entries = entries.filter((e) => ['commissioner', 'admin', 'manager'].includes(e.role));
    } else {
      // Fans only
      entries = entries.filter((e) => e.role === 'fan');
    }
  }

  // Sort by wins (descending), then by accuracy (descending) as tiebreaker
  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.accuracy - a.accuracy;
  });

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

/**
 * Fetches weekly leaderboard stats from database
 */
async function fetchWeeklyLeaderboard(
  leagueId: string,
  season: number,
  weekNumber: number,
  currentUserId: string | undefined,
  roleFilter: LeaderboardRoleFilter
): Promise<LeaderboardEntry[]> {
  // Query WeeklyStats with user data
  const stats = await prisma.weeklyStats.findMany({
    where: {
      leagueId,
      season,
      weekNumber,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          image: true,
        },
      },
    },
    orderBy: {
      correctPicks: 'desc',
    },
  });

  // Get memberships for roles and team names
  const memberships = await prisma.leagueMembership.findMany({
    where: {
      leagueId,
      status: 'approved',
      userId: {
        in: stats.map((s) => s.userId),
      },
    },
    include: {
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));

  let entries: LeaderboardEntry[] = stats.map((stat) => {
    const membership = membershipMap.get(stat.userId);
    const role = mapRole(membership?.role || 'fan');
    const wins = stat.correctPicks;
    const losses = stat.totalPicks - stat.correctPicks;

    return {
      id: stat.id,
      rank: 0,
      userId: stat.userId,
      username: stat.user.username || stat.user.name || 'Unknown',
      avatarUrl: stat.user.avatarUrl || stat.user.image || undefined,
      teamName: membership?.team?.name || undefined,
      role,
      wins,
      losses,
      totalPicks: stat.totalPicks,
      accuracy: Math.round(stat.accuracy),
      isCurrentUser: stat.userId === currentUserId,
    };
  });

  // Apply role filter
  if (roleFilter !== 'all') {
    if (roleFilter === 'manager') {
      entries = entries.filter((e) => ['commissioner', 'admin', 'manager'].includes(e.role));
    } else {
      entries = entries.filter((e) => e.role === 'fan');
    }
  }

  // Sort and assign ranks
  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.accuracy - a.accuracy;
  });

  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

/**
 * Fetches all-time leaderboard stats from database
 */
async function fetchAllTimeLeaderboard(
  leagueId: string,
  currentUserId: string | undefined,
  roleFilter: LeaderboardRoleFilter
): Promise<LeaderboardEntry[]> {
  // Query AllTimeStats with user data
  const stats = await prisma.allTimeStats.findMany({
    where: {
      leagueId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          image: true,
        },
      },
    },
    orderBy: {
      correctPicks: 'desc',
    },
  });

  // Get memberships for roles and team names
  const memberships = await prisma.leagueMembership.findMany({
    where: {
      leagueId,
      status: 'approved',
      userId: {
        in: stats.map((s) => s.userId),
      },
    },
    include: {
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));

  let entries: LeaderboardEntry[] = stats.map((stat) => {
    const membership = membershipMap.get(stat.userId);
    const role = mapRole(membership?.role || 'fan');
    const wins = stat.correctPicks;
    const losses = stat.totalPicks - stat.correctPicks;

    return {
      id: stat.id,
      rank: 0,
      userId: stat.userId,
      username: stat.user.username || stat.user.name || 'Unknown',
      avatarUrl: stat.user.avatarUrl || stat.user.image || undefined,
      teamName: membership?.team?.name || undefined,
      role,
      wins,
      losses,
      totalPicks: stat.totalPicks,
      accuracy: Math.round(stat.accuracy),
      isCurrentUser: stat.userId === currentUserId,
    };
  });

  // Apply role filter
  if (roleFilter !== 'all') {
    if (roleFilter === 'manager') {
      entries = entries.filter((e) => ['commissioner', 'admin', 'manager'].includes(e.role));
    } else {
      entries = entries.filter((e) => e.role === 'fan');
    }
  }

  // Sort and assign ranks
  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.accuracy - a.accuracy;
  });

  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

/**
 * Fetches leaderboard data from database
 */
async function fetchLeaderboard(
  leagueSlug: string,
  scope: LeaderboardScope,
  roleFilter: LeaderboardRoleFilter,
  weekNumber: number | undefined,
  currentUserId: string | undefined
): Promise<LeaderboardResponse> {
  // Get current week from NFL state
  const currentWeek = await getCurrentNFLWeek();

  // Get league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, season: true },
  });

  if (!league) {
    // Return empty leaderboard if league not found
    return {
      standings: [],
      scope,
      roleFilter,
      currentWeek,
      weekNumber: scope === 'weekly' ? weekNumber || currentWeek : undefined,
      seasonYear: DEFAULT_CURRENT_SEASON,
      leagueAverage: 0,
    };
  }
  const seasonYear = league.season || DEFAULT_CURRENT_SEASON;

  let standings: LeaderboardEntry[];

  switch (scope) {
    case 'weekly':
      standings = await fetchWeeklyLeaderboard(
        league.id,
        seasonYear,
        weekNumber || currentWeek,
        currentUserId,
        roleFilter
      );
      break;
    case 'all-time':
      standings = await fetchAllTimeLeaderboard(league.id, currentUserId, roleFilter);
      break;
    case 'season':
    default:
      standings = await fetchSeasonLeaderboard(league.id, seasonYear, currentUserId, roleFilter);
      break;
  }

  const leagueAverage = calculateLeagueAverage(standings);

  return {
    standings,
    scope,
    roleFilter,
    currentWeek,
    weekNumber: scope === 'weekly' ? weekNumber || currentWeek : undefined,
    seasonYear,
    leagueAverage,
  };
}

/**
 * Get leaderboard with caching.
 * Uses Next.js unstable_cache for data caching with tag-based revalidation.
 *
 * @param input - Input containing league slug, scope, role filter, and optional week number
 * @returns LeaderboardResponse with rankings data
 */
export async function getLeaderboard(input: GetLeaderboardInput): Promise<LeaderboardResponse> {
  const { leagueSlug, scope = 'season', roleFilter = 'all', weekNumber } = input;

  // Get current user for highlighting
  const session = await auth();
  const currentUserId = session?.user?.id;

  // Cache key includes all query parameters
  const cacheKey = `leaderboard-${leagueSlug}-${scope}-${roleFilter}-${weekNumber || 'current'}`;

  // Use unstable_cache for caching with tag-based revalidation
  const getCachedLeaderboard = unstable_cache(
    async () => fetchLeaderboard(leagueSlug, scope, roleFilter, weekNumber, currentUserId),
    [cacheKey],
    {
      tags: [`leaderboard-${leagueSlug}`],
      revalidate: 300, // Revalidate every 5 minutes
    }
  );

  return getCachedLeaderboard();
}
