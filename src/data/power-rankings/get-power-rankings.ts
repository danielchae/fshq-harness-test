import { prisma } from '@/lib/db';

// Power rankings data types
export interface TeamRanking {
  id: string;
  teamId: string;
  teamName: string;
  ownerUsername: string;
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
  rank: number;
  previousRank?: number;
  commentary: string;
}

export interface PowerRankingsData {
  id?: string;
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  rankings: TeamRanking[];
  status: 'draft' | 'published';
  lastSaved?: string;
  publishedAt?: string;
}

// Data layer for power rankings
// Backend implementation with Prisma queries (task-27)

export interface GetPowerRankingsInput {
  leagueSlug: string;
  weekNumber: number;
  season?: number;
}

export interface UpdatePowerRankingsInput {
  leagueSlug: string;
  weekNumber: number;
  season: number;
  rankings: TeamRanking[];
}

export interface UpdateTeamCommentaryInput {
  leagueSlug: string;
  weekNumber: number;
  season: number;
  teamId: string;
  commentary: string;
}

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
 * Create an empty power rankings response
 * Used when no rankings exist for the requested week
 */
function createEmptyRankingsResponse(
  leagueSlug: string,
  weekNumber: number,
  season: number
): PowerRankingsData {
  return {
    leagueSlug,
    seasonId: `season-${season}`,
    weekNumber,
    rankings: [],
    status: 'draft',
  };
}

/**
 * Get power rankings for a specific week
 * Uses Prisma to fetch from database, returns empty state if no data exists
 */
export async function getPowerRankings(input: GetPowerRankingsInput): Promise<PowerRankingsData> {
  const { leagueSlug, weekNumber, season } = input;

  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  // If no league found, return empty rankings
  if (!league) {
    return createEmptyRankingsResponse(leagueSlug, weekNumber, season ?? new Date().getFullYear());
  }

  // Try to fetch from database
  const currentSeason = season ?? league.season;
  const powerRanking = await prisma.powerRanking.findUnique({
    where: {
      league_season_week_unique: {
        leagueId: league.id,
        season: currentSeason,
        weekNumber,
      },
    },
    include: {
      entries: {
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
      },
    },
  });

  // If no power ranking in database, return empty state
  if (!powerRanking) {
    return createEmptyRankingsResponse(leagueSlug, weekNumber, currentSeason);
  }

  // Build the PowerRankingsData response from database
  const teamRankings: TeamRanking[] = powerRanking.entries.map((entry) => ({
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

  return {
    id: powerRanking.id,
    leagueSlug,
    seasonId: `season-${currentSeason}`,
    weekNumber,
    rankings: teamRankings,
    status: powerRanking.status,
    lastSaved: powerRanking.updatedAt.toISOString(),
    publishedAt: powerRanking.publishedAt?.toISOString(),
  };
}

/**
 * Update power rankings for a specific week
 * Uses Prisma to upsert records in the database
 */
export async function updatePowerRankings(input: UpdatePowerRankingsInput): Promise<PowerRankingsData> {
  const { leagueSlug, weekNumber, season, rankings } = input;

  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  // If no league found, throw error - cannot update rankings for non-existent league
  if (!league) {
    throw new Error(`League not found: ${leagueSlug}`);
  }

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

  return {
    id: powerRanking.id,
    leagueSlug,
    seasonId: `season-${season}`,
    weekNumber,
    rankings: teamRankings,
    status: powerRanking.status,
    lastSaved: powerRanking.updatedAt.toISOString(),
    publishedAt: powerRanking.publishedAt?.toISOString(),
  };
}

/**
 * Update commentary for a specific team in power rankings
 * Uses Prisma to update the database
 */
export async function updateTeamCommentary(input: UpdateTeamCommentaryInput): Promise<PowerRankingsData> {
  const { leagueSlug, weekNumber, season, teamId, commentary } = input;

  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  // If no league found, throw error - cannot update commentary for non-existent league
  if (!league) {
    throw new Error(`League not found: ${leagueSlug}`);
  }

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

  return {
    id: powerRanking.id,
    leagueSlug,
    seasonId: `season-${season}`,
    weekNumber,
    rankings: teamRankings,
    status: powerRanking.status,
    lastSaved: new Date().toISOString(),
    publishedAt: powerRanking.publishedAt?.toISOString(),
  };
}

// Types are exported from this file directly (defined at the top)
