import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

// Data layer for rankings history
// Backend implementation with Prisma queries (task-37)

// Types for rankings history data
export interface WeeklyRank {
  week: number;
  rank: number;
}

export interface TeamRankingHistory {
  teamId: string;
  teamName: string;
  color: string;
  history: WeeklyRank[];
}

export interface RankingsHistoryData {
  leagueSlug: string;
  seasonId: string;
  history: TeamRankingHistory[];
  totalWeeks: number;
}

export interface GetRankingsHistoryInput {
  leagueSlug: string;
  season?: number;
}

// Predefined colors for teams (good contrast, colorblind-friendly)
const TEAM_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#65a30d', // lime
  '#e11d48', // rose
  '#0d9488', // teal
  '#7c3aed', // violet
  '#d97706', // amber
];

/**
 * Create an empty rankings history response
 */
function createEmptyHistoryResponse(leagueSlug: string, season: number): RankingsHistoryData {
  return {
    leagueSlug,
    seasonId: `season-${season}`,
    history: [],
    totalWeeks: 0,
  };
}

/**
 * Get rankings history for a league showing team rank progressions across weeks
 * Uses Prisma to query PowerRanking and PowerRankingEntry tables
 */
async function getRankingsHistoryInternal(input: GetRankingsHistoryInput): Promise<RankingsHistoryData> {
  const { leagueSlug, season } = input;

  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  // If no league found, return empty history
  if (!league) {
    return createEmptyHistoryResponse(leagueSlug, season ?? new Date().getFullYear());
  }

  // Use current season if not provided
  const currentSeason = season ?? league.season;

  // Query all published power rankings for the league in this season
  const powerRankings = await prisma.powerRanking.findMany({
    where: {
      leagueId: league.id,
      season: currentSeason,
      status: 'published', // Only show published rankings in history
    },
    include: {
      entries: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { weekNumber: 'asc' },
  });

  // If no rankings in database, return empty history
  if (powerRankings.length === 0) {
    return createEmptyHistoryResponse(leagueSlug, currentSeason);
  }

  // Build a map of team histories
  const teamHistories = new Map<string, TeamRankingHistory>();

  // Track team color assignments for consistency
  const teamColorAssignments = new Map<string, string>();
  let colorIndex = 0;

  // Process each week's rankings
  for (const ranking of powerRankings) {
    for (const entry of ranking.entries) {
      const teamId = entry.teamId;
      const teamName = entry.team.name;

      // Assign color if not already assigned
      if (!teamColorAssignments.has(teamId)) {
        teamColorAssignments.set(teamId, TEAM_COLORS[colorIndex % TEAM_COLORS.length] ?? '#2563eb');
        colorIndex++;
      }

      // Get or create team history entry
      let teamHistory = teamHistories.get(teamId);
      if (!teamHistory) {
        teamHistory = {
          teamId,
          teamName,
          color: teamColorAssignments.get(teamId) ?? '#2563eb',
          history: [],
        };
        teamHistories.set(teamId, teamHistory);
      }

      // Add this week's rank to history
      teamHistory.history.push({
        week: ranking.weekNumber,
        rank: entry.rank,
      });
    }
  }

  // Sort each team's history by week number
  for (const teamHistory of teamHistories.values()) {
    teamHistory.history.sort((a, b) => a.week - b.week);
  }

  // Find the total weeks (highest week number among all rankings)
  const totalWeeks = powerRankings.reduce((max, r) => Math.max(max, r.weekNumber), 0);

  // Convert map to array and sort by first appearance
  const historyArray = Array.from(teamHistories.values());

  return {
    leagueSlug,
    seasonId: `season-${currentSeason}`,
    history: historyArray,
    totalWeeks,
  };
}

/**
 * Get rankings history with caching
 * Cache is tagged for easy invalidation when rankings are published
 */
export async function getRankingsHistory(input: GetRankingsHistoryInput): Promise<RankingsHistoryData> {
  const { leagueSlug, season } = input;

  // In test environment or if unstable_cache fails, call internal directly
  // unstable_cache requires Next.js server context
  try {
    // Create cached version with league-specific tag
    const getCachedHistory = unstable_cache(
      async () => getRankingsHistoryInternal({ leagueSlug, season }),
      [`rankings-history-${leagueSlug}-${season ?? 'current'}`],
      {
        tags: [`rankings-history-${leagueSlug}`],
        revalidate: 60, // Revalidate every 60 seconds as fallback
      }
    );

    return await getCachedHistory();
  } catch {
    // Fallback to uncached version if caching fails (e.g., in test environment)
    return getRankingsHistoryInternal({ leagueSlug, season });
  }
}

// Types are exported directly from this file (defined at the top)
