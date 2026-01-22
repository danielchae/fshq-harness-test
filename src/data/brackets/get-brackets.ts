// Data layer for fetching playoff bracket data
// Prisma implementation with caching

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

import type {
  BracketMatchup,
  BracketMatchupTeam,
  BracketResponse,
  BracketRound,
  BracketTeam,
  PlayoffBracket,
} from '@/types/brackets';
import type { Decimal } from '@prisma/client/runtime/client';

export interface GetBracketInput {
  leagueSlug: string;
  season?: number;
}

// Default values
const DEFAULT_CURRENT_WEEK = 15;
const DEFAULT_PLAYOFFS_START_WEEK = 14;
const DEFAULT_SEASON = 2025;

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
 * Get round name based on playoff round number and total rounds
 */
function getRoundName(roundIndex: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - roundIndex;

  if (roundsFromEnd === 1) return 'Championship';
  if (roundsFromEnd === 2) return 'Semifinals';
  if (roundsFromEnd === 3) return 'Quarterfinals';
  if (roundsFromEnd === 4) return 'First Round';

  // Generic naming for larger brackets
  return `Round ${roundIndex + 1}`;
}

/**
 * Transform a team from database to BracketTeam format
 */
function transformTeamToBracketTeam(
  team: {
    id: string;
    name: string;
    avatarUrl: string | null;
    wins: number;
    losses: number;
    ties: number;
  },
  seed: number
): BracketTeam {
  return {
    id: team.id,
    name: team.name,
    seed,
    avatarUrl: team.avatarUrl ?? undefined,
    record: {
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
    },
  };
}

/**
 * Build bracket structure from matchups
 */
function buildBracketFromMatchups(
  matchups: {
    id: string;
    weekNumber: number;
    playoffRound: number | null;
    isComplete: boolean;
    winnerId: string | null;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeamScore: Decimal | null;
    awayTeamScore: Decimal | null;
    homeTeam: {
      id: string;
      name: string;
      avatarUrl: string | null;
      wins: number;
      losses: number;
      ties: number;
    };
    awayTeam: {
      id: string;
      name: string;
      avatarUrl: string | null;
      wins: number;
      losses: number;
      ties: number;
    };
    winner: {
      id: string;
      name: string;
      avatarUrl: string | null;
      wins: number;
      losses: number;
      ties: number;
    } | null;
  }[],
  leagueId: string,
  season: number,
  type: 'winners' | 'consolation'
): { bracket: PlayoffBracket | null; minWeek: number; maxWeek: number } {
  if (matchups.length === 0) {
    return { bracket: null, minWeek: DEFAULT_PLAYOFFS_START_WEEK, maxWeek: DEFAULT_CURRENT_WEEK };
  }

  // Group matchups by round
  const matchupsByRound = new Map<number, typeof matchups>();
  let maxRound = 0;
  let minWeek = Infinity;
  let maxWeek = 0;

  for (const matchup of matchups) {
    const round = matchup.playoffRound ?? 1;
    if (!matchupsByRound.has(round)) {
      matchupsByRound.set(round, []);
    }
    const roundMatchups = matchupsByRound.get(round);
    if (roundMatchups) {
      roundMatchups.push(matchup);
    }

    maxRound = Math.max(maxRound, round);
    minWeek = Math.min(minWeek, matchup.weekNumber);
    maxWeek = Math.max(maxWeek, matchup.weekNumber);
  }

  // Build seed map based on team performance (wins) for seeding
  const teamSeeds = new Map<string, number>();
  const allTeamIds = new Set<string>();

  for (const matchup of matchups) {
    allTeamIds.add(matchup.homeTeamId);
    allTeamIds.add(matchup.awayTeamId);
  }

  // Sort teams by wins to determine seeds
  const sortedTeams = matchups.flatMap((m) => [m.homeTeam, m.awayTeam]);
  const uniqueTeams = Array.from(new Map(sortedTeams.map((t) => [t.id, t])).values());
  uniqueTeams.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  uniqueTeams.forEach((team, index) => {
    // For consolation bracket, seeds start after winners bracket teams
    const baseSeed = type === 'consolation' ? uniqueTeams.length : 0;
    teamSeeds.set(team.id, baseSeed + index + 1);
  });

  // Build rounds array
  const rounds: BracketRound[] = [];
  const totalRounds = maxRound;

  // Determine current round (first incomplete round, or last round if all complete)
  let currentRoundIndex = 0;
  let allComplete = true;

  for (let roundNum = 1; roundNum <= maxRound; roundNum++) {
    const roundMatchups = matchupsByRound.get(roundNum) || [];
    const roundIndex = roundNum - 1;

    const hasIncomplete = roundMatchups.some((m) => !m.isComplete);
    if (hasIncomplete && allComplete) {
      currentRoundIndex = roundIndex;
      allComplete = false;
    }

    const bracketMatchups: BracketMatchup[] = roundMatchups.map((matchup, matchupIndex) => {
      const homeTeamSeed = teamSeeds.get(matchup.homeTeamId) ?? 0;
      const awayTeamSeed = teamSeeds.get(matchup.awayTeamId) ?? 0;

      // Get score - use homeScore/awayScore (Float) or fall back to homeTeamScore/awayTeamScore (Decimal)
      const homeScore = matchup.homeScore ?? decimalToNumber(matchup.homeTeamScore);
      const awayScore = matchup.awayScore ?? decimalToNumber(matchup.awayTeamScore);

      const homeTeam: BracketMatchupTeam = {
        team: transformTeamToBracketTeam(matchup.homeTeam, homeTeamSeed),
        score: homeScore,
        isWinner: matchup.isComplete && matchup.winnerId === matchup.homeTeamId,
      };

      const awayTeam: BracketMatchupTeam = {
        team: transformTeamToBracketTeam(matchup.awayTeam, awayTeamSeed),
        score: awayScore,
        isWinner: matchup.isComplete && matchup.winnerId === matchup.awayTeamId,
      };

      // Determine matchup status
      let status: 'scheduled' | 'in_progress' | 'complete' = 'scheduled';
      if (matchup.isComplete) {
        status = 'complete';
      } else if (homeScore !== undefined || awayScore !== undefined) {
        status = 'in_progress';
      }

      return {
        id: matchup.id,
        roundIndex,
        matchupIndex,
        homeTeam,
        awayTeam,
        isComplete: matchup.isComplete,
        winnerId: matchup.winnerId ?? undefined,
        status,
      };
    });

    // Get round name based on bracket type
    const roundName =
      type === 'consolation'
        ? roundIndex === totalRounds - 1
          ? 'Consolation Final'
          : `Consolation Round ${roundIndex + 1}`
        : getRoundName(roundIndex, totalRounds);

    rounds.push({
      index: roundIndex,
      name: roundName,
      matchups: bracketMatchups,
      isCurrent: !allComplete && roundIndex === currentRoundIndex,
    });
  }

  // If all rounds complete, mark the last round as current
  if (allComplete && rounds.length > 0) {
    currentRoundIndex = rounds.length - 1;
    const lastRound = rounds[currentRoundIndex];
    if (lastRound) {
      lastRound.isCurrent = true;
    }
  }

  // Find champion (winner of final round)
  let champion: BracketTeam | undefined;
  if (rounds.length > 0) {
    const finalRound = rounds[rounds.length - 1] as BracketRound;
    const championshipMatch = finalRound.matchups[0];
    if (championshipMatch?.isComplete && championshipMatch.winnerId) {
      const winnerTeam = championshipMatch.homeTeam.isWinner
        ? championshipMatch.homeTeam.team
        : championshipMatch.awayTeam.team;

      if (winnerTeam) {
        champion = winnerTeam;
      }
    }
  }

  const bracket: PlayoffBracket = {
    id: `bracket-${leagueId}-${season}-${type}`,
    leagueId: leagueId,
    season,
    type,
    rounds,
    champion,
    playoffsStartWeek: minWeek,
    currentRoundIndex,
  };

  return { bracket, minWeek, maxWeek };
}

/**
 * Fetch bracket from database
 */
async function fetchBracketFromDb(leagueSlug: string, requestedSeason?: number): Promise<BracketResponse | null> {
  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  if (!league) {
    return null;
  }

  const season = requestedSeason ?? league.season ?? DEFAULT_SEASON;

  // Fetch all playoff matchups (winners bracket) for this league and season
  const playoffMatchups = await prisma.matchup.findMany({
    where: {
      leagueId: league.id,
      season,
      isPlayoff: true,
      matchupType: 'playoff', // Winners bracket
    },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true,
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
          avatarUrl: true,
          wins: true,
          losses: true,
          ties: true,
        },
      },
      winner: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          wins: true,
          losses: true,
          ties: true,
        },
      },
    },
    orderBy: [{ playoffRound: 'asc' }, { weekNumber: 'asc' }, { createdAt: 'asc' }],
  });

  // Fetch consolation bracket matchups (toilet bowl)
  const consolationMatchups = await prisma.matchup.findMany({
    where: {
      leagueId: league.id,
      season,
      matchupType: 'toilet_bowl',
    },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true,
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
          avatarUrl: true,
          wins: true,
          losses: true,
          ties: true,
        },
      },
      winner: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          wins: true,
          losses: true,
          ties: true,
        },
      },
    },
    orderBy: [{ playoffRound: 'asc' }, { weekNumber: 'asc' }, { createdAt: 'asc' }],
  });

  // If no playoff matchups, playoffs haven't started
  if (playoffMatchups.length === 0 && consolationMatchups.length === 0) {
    // Get available seasons that have playoff data
    const seasonsWithPlayoffs = await prisma.matchup.findMany({
      where: {
        leagueId: league.id,
        OR: [{ isPlayoff: true }, { matchupType: 'toilet_bowl' }],
      },
      select: {
        season: true,
      },
      distinct: ['season'],
      orderBy: {
        season: 'desc',
      },
    });

    const availableSeasons = seasonsWithPlayoffs.map((s) => s.season);

    return {
      playoffsStartWeek: DEFAULT_PLAYOFFS_START_WEEK,
      hasStarted: false,
      currentWeek: DEFAULT_CURRENT_WEEK,
      bracket: null,
      hasConsolation: false,
      consolationBracket: null,
      availableSeasons: availableSeasons.length > 0 ? availableSeasons : [season],
      season,
    };
  }

  // Build winners bracket
  const { bracket, minWeek, maxWeek } = buildBracketFromMatchups(
    playoffMatchups,
    league.id,
    season,
    'winners'
  );

  // Build consolation bracket if there are consolation matchups
  const hasConsolation = consolationMatchups.length > 0;
  let consolationBracket: PlayoffBracket | null = null;

  if (hasConsolation) {
    const consolationResult = buildBracketFromMatchups(
      consolationMatchups,
      league.id,
      season,
      'consolation'
    );
    consolationBracket = consolationResult.bracket;
  }

  // Get available seasons
  const seasonsWithPlayoffs = await prisma.matchup.findMany({
    where: {
      leagueId: league.id,
      OR: [{ isPlayoff: true }, { matchupType: 'toilet_bowl' }],
    },
    select: {
      season: true,
    },
    distinct: ['season'],
    orderBy: {
      season: 'desc',
    },
  });

  const availableSeasons = seasonsWithPlayoffs.map((s) => s.season);
  if (!availableSeasons.includes(season)) {
    availableSeasons.push(season);
    availableSeasons.sort((a, b) => b - a);
  }

  return {
    playoffsStartWeek: minWeek,
    hasStarted: playoffMatchups.length > 0,
    currentWeek: maxWeek,
    bracket,
    hasConsolation,
    consolationBracket,
    availableSeasons,
    season,
  };
}

/**
 * Cached bracket fetcher with tag-based revalidation
 */
const getCachedBracket = unstable_cache(
  async (leagueSlug: string, season: number | undefined) => {
    return fetchBracketFromDb(leagueSlug, season);
  },
  ['brackets'],
  {
    tags: ['brackets'], // Base tag for bracket data
    revalidate: 300, // Cache for 5 minutes (300 seconds)
  }
);

/**
 * Get playoff bracket data for a league
 *
 * Queries playoff matchups in tree structure.
 * Includes scores for completed rounds.
 * Shows winners progressing through rounds.
 * Returns BracketResponse with playoff data.
 *
 * @param input - Bracket query parameters
 * @returns BracketResponse with playoff bracket data
 */
export async function getBracket(input: GetBracketInput): Promise<BracketResponse> {
  const { leagueSlug, season } = input;

  // Try to get cached bracket from database
  const result = await getCachedBracket(leagueSlug, season);

  if (result) {
    return result;
  }

  // Fallback: return empty response if league not found
  const currentSeason = season ?? DEFAULT_SEASON;

  return {
    playoffsStartWeek: DEFAULT_PLAYOFFS_START_WEEK,
    hasStarted: false,
    currentWeek: DEFAULT_CURRENT_WEEK,
    bracket: null,
    hasConsolation: false,
    availableSeasons: [currentSeason],
    season: currentSeason,
  };
}
