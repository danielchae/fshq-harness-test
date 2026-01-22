/**
 * League History Data Fetcher
 *
 * Fetches historical season data and all-time records for a league.
 * Implements Prisma queries against SeasonHistory and related models.
 * 
 * If no local history exists for a Sleeper league, fetches from Sleeper API
 * by following the previous_league_id chain.
 *
 * @module src/data/history/get-league-history
 */

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';
import { fetchLeagueHistory as fetchSleeperHistory } from '@/integrations/sleeper/fetch-league-history';

import type {
  AllTimeRecord,
  GetLeagueHistoryInput,
  LeagueHistoryResponse,
  SeasonSummary,
  TeamStanding,
} from '@/types/history';

/**
 * Interface for Prisma SeasonHistory record
 */
interface PrismaSeasonHistory {
  id: string;
  leagueId: string;
  year: number;
  champion: string;
  runnerUp: string;
  totalMembers: number;
  championshipScore: string | null;
  thirdPlace: string | null;
  regularSeasonWinner: string | null;
  playoffTeams: number | null;
  highestWeeklyScore: number | null;
  seasonSummary: string | null;
  dynastyContinuityData: unknown;
  league: {
    name: string;
    isDynasty: boolean;
  };
}

/**
 * Maps a Prisma SeasonHistory record to the SeasonSummary type contract
 * Note: The database stores simplified data, so we generate reasonable defaults
 * for fields that require detailed team/standings data
 */
function mapPrismaToSeasonSummary(season: PrismaSeasonHistory): SeasonSummary {
  // Parse championship score if available (format: "156.8 - 148.2")
  let championPoints = 0;
  let runnerUpPoints = 0;
  if (season.championshipScore) {
    const parts = season.championshipScore.split(' - ').map((s) => parseFloat(s.trim()));
    const part0 = parts[0];
    const part1 = parts[1];
    if (parts.length === 2 && part0 !== undefined && part1 !== undefined && !isNaN(part0) && !isNaN(part1)) {
      championPoints = part0;
      runnerUpPoints = part1;
    }
  }

  // Determine league format from isDynasty flag
  const format: 'dynasty' | 'redraft' | 'keeper' = season.league.isDynasty ? 'dynasty' : 'redraft';

  // Build standings from available data
  // Note: avatarUrl is empty as we don't store avatar data in simplified history schema
  // UI components use AvatarFallback to render initials when avatarUrl is empty
  const standings: TeamStanding[] = [
    {
      teamId: `champion-${season.year}`,
      teamName: season.champion,
      managerName: season.champion,
      avatarUrl: '',
      rank: 1,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      playoffResult: 'champion',
    },
    {
      teamId: `runner-up-${season.year}`,
      teamName: season.runnerUp,
      managerName: season.runnerUp,
      avatarUrl: '',
      rank: 2,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      playoffResult: 'runner-up',
    },
  ];

  // Add third place if available
  if (season.thirdPlace) {
    standings.push({
      teamId: `third-${season.year}`,
      teamName: season.thirdPlace,
      managerName: season.thirdPlace,
      avatarUrl: '',
      rank: 3,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      playoffResult: 'third',
    });
  }

  return {
    id: season.id,
    year: season.year,
    leagueId: season.leagueId,
    leagueName: season.league.name,
    format,
    teamCount: season.totalMembers,
    completed: true, // Historical seasons are by definition completed
    champion: {
      teamId: `champion-${season.year}`,
      teamName: season.champion,
      managerName: season.champion,
      avatarUrl: '',
      record: '', // Not stored in simplified schema
      totalPoints: championPoints > 0 ? championPoints : 0,
    },
    runnerUp: {
      teamId: `runner-up-${season.year}`,
      teamName: season.runnerUp,
      managerName: season.runnerUp,
      avatarUrl: '',
      record: '', // Not stored in simplified schema
      totalPoints: runnerUpPoints > 0 ? runnerUpPoints : 0,
    },
    championshipScore: {
      championPoints,
      runnerUpPoints,
      week: 16, // Default championship week
    },
    regularSeasonWinner: season.regularSeasonWinner
      ? {
          teamId: `reg-winner-${season.year}`,
          teamName: season.regularSeasonWinner,
          managerName: season.regularSeasonWinner,
          record: '',
        }
      : undefined,
    standings,
    stats: {
      totalPointsScored: 0, // Not stored in simplified schema
      highestScoringWeek: {
        teamName: season.champion,
        points: season.highestWeeklyScore ?? 0,
        week: 1,
      },
      averagePointsPerGame: 0, // Not stored in simplified schema
      playoffTeams: season.playoffTeams ?? 6,
    },
  };
}

/**
 * Calculate all-time records from season history data
 */
function calculateAllTimeRecords(seasons: PrismaSeasonHistory[]): AllTimeRecord[] {
  if (seasons.length === 0) {
    return [];
  }

  const records: AllTimeRecord[] = [];

  // Count championships per team/manager
  const championshipCounts: Record<string, { count: number; years: string[] }> = {};
  for (const season of seasons) {
    const existing = championshipCounts[season.champion];
    if (!existing) {
      championshipCounts[season.champion] = { count: 1, years: [season.year.toString()] };
    } else {
      existing.count++;
      existing.years.push(season.year.toString());
    }
  }

  // Find most championships
  const mostChampionships = Object.entries(championshipCounts).sort((a, b) => b[1].count - a[1].count)[0];
  if (mostChampionships && mostChampionships[1].count > 0) {
    records.push({
      type: 'most-championships',
      title: 'Most Championships',
      holder: {
        name: mostChampionships[0],
        avatarUrl: '',
      },
      value: mostChampionships[1].count.toString(),
      seasons: mostChampionships[1].years,
    });
  }

  // Find highest weekly score
  const seasonWithHighestScore = seasons
    .filter((s) => s.highestWeeklyScore !== null)
    .sort((a, b) => (b.highestWeeklyScore ?? 0) - (a.highestWeeklyScore ?? 0))[0];

  if (seasonWithHighestScore && seasonWithHighestScore.highestWeeklyScore) {
    records.push({
      type: 'most-points',
      title: 'Highest Single Week Score',
      holder: {
        name: seasonWithHighestScore.champion,
        avatarUrl: '',
      },
      value: seasonWithHighestScore.highestWeeklyScore.toFixed(1),
      seasons: [seasonWithHighestScore.year.toString()],
    });
  }

  // Find most playoff appearances (appearing as champion or runner-up)
  const playoffAppearances: Record<string, { count: number; years: string[] }> = {};
  for (const season of seasons) {
    // Champion appeared in playoffs
    const championEntry = playoffAppearances[season.champion];
    if (!championEntry) {
      playoffAppearances[season.champion] = { count: 1, years: [season.year.toString()] };
    } else {
      championEntry.count++;
      championEntry.years.push(season.year.toString());
    }

    // Runner-up appeared in playoffs
    const runnerUpEntry = playoffAppearances[season.runnerUp];
    if (!runnerUpEntry) {
      playoffAppearances[season.runnerUp] = { count: 1, years: [season.year.toString()] };
    } else {
      runnerUpEntry.count++;
      if (!runnerUpEntry.years.includes(season.year.toString())) {
        runnerUpEntry.years.push(season.year.toString());
      }
    }
  }

  const mostPlayoffAppearances = Object.entries(playoffAppearances).sort((a, b) => b[1].count - a[1].count)[0];
  if (mostPlayoffAppearances && mostPlayoffAppearances[1].count > 0) {
    records.push({
      type: 'most-playoff-appearances',
      title: 'Most Playoff Appearances',
      holder: {
        name: mostPlayoffAppearances[0],
        avatarUrl: '',
      },
      value: mostPlayoffAppearances[1].count.toString(),
      seasons: [...new Set(mostPlayoffAppearances[1].years)], // Deduplicate years
    });
  }

  return records;
}

/**
 * Core history fetching logic - fetches season history from database
 */
async function fetchLeagueHistoryFromDb(leagueSlug: string): Promise<LeagueHistoryResponse> {
  // Find the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  // Return empty history if league not found
  if (!league) {
    return {
      seasons: [],
      allTimeRecords: [],
    };
  }

  // Fetch all season histories for this league, ordered by year DESC (most recent first)
  const seasonHistories = await prisma.seasonHistory.findMany({
    where: { leagueId: league.id },
    orderBy: { year: 'desc' },
    include: {
      league: {
        select: {
          name: true,
          isDynasty: true,
        },
      },
    },
  });

  const leagueWithPlatform = await prisma.league.findUnique({
    where: { id: league.id },
    select: { platform: true, platformLeagueId: true },
  });

  if (leagueWithPlatform?.platform === 'sleeper' && leagueWithPlatform.platformLeagueId) {
    const existingYears = new Set(seasonHistories.map((season) => season.year));
    const sleeperHistory = await fetchSleeperHistory(leagueWithPlatform.platformLeagueId);

    if (sleeperHistory.success && sleeperHistory.seasons.length > 0) {
      let didUpdate = false;

      for (const season of sleeperHistory.seasons) {
        if (existingYears.has(season.year)) {
          continue;
        }

        try {
          await prisma.seasonHistory.upsert({
            where: {
              league_year_history_unique: {
                leagueId: league.id,
                year: season.year,
              },
            },
            create: {
              leagueId: league.id,
              year: season.year,
              champion: season.champion?.name ?? 'Unknown',
              runnerUp: season.runnerUp?.name ?? 'Unknown',
              totalMembers: season.totalRosters,
              thirdPlace: season.thirdPlace?.name ?? null,
              playoffTeams: Math.min(season.totalRosters, 6),
              highestWeeklyScore: season.rosters.reduce((max, roster) => {
                const pts = (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100;
                return pts > max ? pts : max;
              }, 0),
              championshipScore:
                season.champion && season.runnerUp
                  ? `${season.champion.pointsFor.toFixed(1)} - ${season.runnerUp.pointsFor.toFixed(1)}`
                  : null,
              regularSeasonWinner: season.champion?.name ?? null,
              seasonSummary: `${season.name} - ${season.year} Season`,
              dynastyContinuityData: season.isDynasty ? { sleeperLeagueId: season.leagueId } : null,
            },
            update: {
              champion: season.champion?.name ?? 'Unknown',
              runnerUp: season.runnerUp?.name ?? 'Unknown',
              totalMembers: season.totalRosters,
              thirdPlace: season.thirdPlace?.name ?? null,
              playoffTeams: Math.min(season.totalRosters, 6),
              highestWeeklyScore: season.rosters.reduce((max, roster) => {
                const pts = (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100;
                return pts > max ? pts : max;
              }, 0),
              championshipScore:
                season.champion && season.runnerUp
                  ? `${season.champion.pointsFor.toFixed(1)} - ${season.runnerUp.pointsFor.toFixed(1)}`
                  : null,
              regularSeasonWinner: season.champion?.name ?? null,
              seasonSummary: `${season.name} - ${season.year} Season`,
              dynastyContinuityData: season.isDynasty ? { sleeperLeagueId: season.leagueId } : null,
            },
          });
          didUpdate = true;
        } catch (error) {
          console.error(`[getLeagueHistory] Error storing season ${season.year}:`, error);
        }
      }

      if (didUpdate) {
        const updatedHistories = await prisma.seasonHistory.findMany({
          where: { leagueId: league.id },
          orderBy: { year: 'desc' },
          include: {
            league: {
              select: {
                name: true,
                isDynasty: true,
              },
            },
          },
        });

        const seasons = updatedHistories.map((s) => mapPrismaToSeasonSummary(s));
        const allTimeRecords = calculateAllTimeRecords(updatedHistories);

        return {
          seasons,
          allTimeRecords,
        };
      }
    }
  }

  // Map to SeasonSummary type contract
  const seasons = seasonHistories.map((s) => mapPrismaToSeasonSummary(s));

  // Calculate all-time records from the season data
  const allTimeRecords = calculateAllTimeRecords(seasonHistories);

  return {
    seasons,
    allTimeRecords,
  };
}

/**
 * Get league history data
 *
 * Fetches all past seasons and calculates all-time records.
 * Returns seasons sorted by year (most recent first).
 *
 * @param input - League history query parameters
 * @returns LeagueHistoryResponse with seasons and all-time records
 */
export async function getLeagueHistory(input: GetLeagueHistoryInput): Promise<LeagueHistoryResponse> {
  const { leagueSlug } = input;

  const cacheKey = ['league-history', leagueSlug];
  const getCachedLeagueHistory = unstable_cache(
    async () => {
      return fetchLeagueHistoryFromDb(leagueSlug);
    },
    cacheKey,
    {
      tags: [`league-history-${leagueSlug}`],
      revalidate: 3600, // Cache for 1 hour - history doesn't change often
    }
  );

  return getCachedLeagueHistory();
}

/**
 * Get details for a specific season
 *
 * @param leagueSlug - League slug
 * @param year - Season year
 * @returns SeasonSummary or null if not found
 */
export async function getSeasonDetail(leagueSlug: string, year: number): Promise<SeasonSummary | null> {
  // Find the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  if (!league) {
    return null;
  }

  // Find the specific season
  const seasonHistory = await prisma.seasonHistory.findUnique({
    where: {
      league_year_history_unique: {
        leagueId: league.id,
        year,
      },
    },
    include: {
      league: {
        select: {
          name: true,
          isDynasty: true,
        },
      },
    },
  });

  if (!seasonHistory) {
    return null;
  }

  return mapPrismaToSeasonSummary(seasonHistory);
}

/**
 * Get all-time records for a league
 *
 * @param leagueSlug - League slug
 * @returns AllTimeRecord array
 */
export async function getAllTimeRecords(leagueSlug: string): Promise<AllTimeRecord[]> {
  const history = await getLeagueHistory({ leagueSlug });
  return history.allTimeRecords;
}
