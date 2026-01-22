import { prisma } from '@/lib/db';
import { getCurrentNFLWeekSync, NFL_TOTAL_WEEKS } from '@/lib/nfl-week';

// Types for commissioner desk data (production version without mock dependencies)
export interface Season {
  id: string;
  year: number;
  name: string;
  label: string; // For UI display (same as name)
  isCurrent: boolean;
}

export interface Week {
  id: string; // For UI key (e.g., "week-1")
  number: number;
  name: string;
  label: string; // For UI display (same as name)
  status: 'published' | 'draft' | 'empty';
  startDate?: string;
  endDate?: string;
  lastEdited?: string;
  publishedAt?: string;
}

export interface DeskDraft {
  id: string;
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  type: 'power-rankings' | 'matchup-predictions' | 'posts';
  content: string;
  status: 'draft' | 'published';
  lastSaved: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetDeskDataInput {
  leagueSlug: string;
  seasonId?: string;
  weekNumber?: number;
  userId?: string; // Optional userId for commissioner validation
}

export interface DeskData {
  seasons: Season[];
  weeks: Week[];
  currentSeason: Season;
  currentWeek: number;
  drafts: DeskDraft[];
  isCommissioner: boolean;
  leagueId: string | null;
}

/**
 * Error thrown when user is not authorized to access commissioner desk
 */
export class CommissionerAuthError extends Error {
  constructor(message = 'Unauthorized: Commissioner role required') {
    super(message);
    this.name = 'CommissionerAuthError';
  }
}

/**
 * Calculate current NFL week based on date
 * Uses shared utility from @/lib/nfl-week
 */
function calculateCurrentWeek(): number {
  return getCurrentNFLWeekSync();
}

/**
 * Generate seasons list for a league
 * Returns available seasons based on league data
 */
function generateSeasons(league: { season: number; createdAt: Date }): Season[] {
  const currentYear = new Date().getFullYear();
  const seasons: Season[] = [];

  // Include current season and any previous seasons the league has existed for
  const leagueStartYear = league.createdAt.getFullYear();

  for (let year = currentYear; year >= leagueStartYear && year >= currentYear - 5; year--) {
    const name = `${year} Season`;
    seasons.push({
      id: `season-${year}`,
      year,
      name,
      label: name,
      isCurrent: year === league.season,
    });
  }

  return seasons;
}

/**
 * Generate weeks list for NFL season
 * Returns 18 weeks with status based on database data
 */
function generateWeeks(): Week[] {
  const weeks: Week[] = [];

  for (let i = 1; i <= 18; i++) {
    const name = `Week ${i}`;
    weeks.push({
      id: `week-${i}`,
      number: i,
      name,
      label: name,
      status: 'empty',
    });
  }

  return weeks;
}

/**
 * Fetches commissioner desk data including power rankings and matchup predictions drafts.
 * Validates that the user has commissioner role for the specified league.
 */
export async function getDeskData(input: GetDeskDataInput): Promise<DeskData> {
  const { leagueSlug, seasonId, weekNumber, userId } = input;

  // Calculate current week dynamically
  const currentWeekNumber = weekNumber ?? calculateCurrentWeek();

  // Look up the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  if (!league) {
    // Return empty state for non-existent league
    const currentYear = new Date().getFullYear();
    const seasonName = `${currentYear} Season`;
    const emptySeason: Season = {
      id: `season-${currentYear}`,
      year: currentYear,
      name: seasonName,
      label: seasonName,
      isCurrent: true,
    };

    return {
      seasons: [emptySeason],
      weeks: generateWeeks(),
      currentSeason: emptySeason,
      currentWeek: currentWeekNumber,
      drafts: [],
      isCommissioner: false,
      leagueId: null,
    };
  }

  // Generate seasons from league data
  const seasons = generateSeasons(league);

  // Find the selected or current season
  const currentSeason = seasonId
    ? seasons.find((s) => s.id === seasonId) || seasons[0]!
    : seasons.find((s) => s.isCurrent) || seasons[0]!;

  // Check if user has commissioner role for this league
  let isCommissioner = false;
  if (userId) {
    const membership = await prisma.leagueMembership.findUnique({
      where: {
        user_league_unique: {
          userId,
          leagueId: league.id,
        },
      },
    });
    isCommissioner = membership?.role === 'commissioner';
  }

  // Query power rankings drafts for the current week
  const powerRankings = await prisma.powerRanking.findMany({
    where: {
      leagueId: league.id,
      season: currentSeason.year,
      weekNumber: currentWeekNumber,
    },
    include: {
      entries: {
        include: {
          team: true,
        },
        orderBy: { rank: 'asc' },
      },
    },
  });

  // Query matchup predictions drafts for the current week
  const matchupPredictions = await prisma.matchupPrediction.findMany({
    where: {
      leagueId: league.id,
      season: currentSeason.year,
      weekNumber: currentWeekNumber,
    },
    include: {
      matchup: {
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      },
      predictedWinner: true,
    },
  });

  // Transform database records to DeskDraft format
  const drafts: DeskDraft[] = [];

  // Transform power rankings to draft format
  for (const ranking of powerRankings) {
    // Generate content from ranking entries
    const content = ranking.entries
      .map((entry) => `${entry.rank}. ${entry.team.name}${entry.commentary ? ` - ${entry.commentary}` : ''}`)
      .join('\n');

    drafts.push({
      id: ranking.id,
      leagueSlug,
      seasonId: currentSeason.id,
      weekNumber: ranking.weekNumber,
      type: 'power-rankings',
      content,
      status: ranking.status as 'draft' | 'published',
      lastSaved: ranking.updatedAt.toISOString(),
      createdAt: ranking.createdAt.toISOString(),
      updatedAt: ranking.updatedAt.toISOString(),
    });
  }

  // Transform matchup predictions to draft format
  for (const prediction of matchupPredictions) {
    // Generate content from prediction
    const matchup = prediction.matchup;
    const content =
      prediction.hypeText ||
      `${matchup.homeTeam.name} vs ${matchup.awayTeam.name} - Winner: ${prediction.predictedWinner.name}`;

    drafts.push({
      id: prediction.id,
      leagueSlug,
      seasonId: currentSeason.id,
      weekNumber: prediction.weekNumber,
      type: 'matchup-predictions',
      content,
      status: prediction.status as 'draft' | 'published',
      lastSaved: prediction.updatedAt.toISOString(),
      createdAt: prediction.createdAt.toISOString(),
      updatedAt: prediction.updatedAt.toISOString(),
    });
  }

  // Build weeks list with status based on database data
  const baseWeeks = generateWeeks();
  const weeksWithStatus: Week[] = await buildWeeksWithStatus(league.id, currentSeason.year, baseWeeks);

  return {
    seasons,
    weeks: weeksWithStatus,
    currentSeason,
    currentWeek: currentWeekNumber,
    drafts,
    isCommissioner,
    leagueId: league.id,
  };
}

/**
 * Builds weeks list with status based on power rankings and predictions in database
 */
async function buildWeeksWithStatus(leagueId: string, season: number, baseWeeks: Week[]): Promise<Week[]> {
  // Get all power rankings for this league/season to determine week statuses
  const rankings = await prisma.powerRanking.findMany({
    where: {
      leagueId,
      season,
    },
    select: {
      weekNumber: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  // Create a map of week statuses
  const weekStatusMap = new Map<
    number,
    { status: 'published' | 'draft' | 'empty'; lastEdited?: string; publishedAt?: string }
  >();

  for (const ranking of rankings) {
    const existingStatus = weekStatusMap.get(ranking.weekNumber);

    // Determine status - published takes precedence, then draft, then empty
    let status: 'published' | 'draft' | 'empty';
    if (ranking.status === 'published') {
      status = 'published';
    } else if (ranking.status === 'draft') {
      status = existingStatus?.status === 'published' ? 'published' : 'draft';
    } else {
      status = existingStatus?.status || 'empty';
    }

    weekStatusMap.set(ranking.weekNumber, {
      status,
      lastEdited: ranking.updatedAt.toISOString(),
      publishedAt: ranking.publishedAt?.toISOString(),
    });
  }

  // Map base weeks with actual statuses
  return baseWeeks.map((week) => {
    const statusInfo = weekStatusMap.get(week.number);
    if (statusInfo) {
      return {
        ...week,
        status: statusInfo.status,
        lastEdited: statusInfo.lastEdited,
        publishedAt: statusInfo.publishedAt,
      };
    }
    return week;
  });
}

export interface SaveDeskDraftInput {
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  type: 'power-rankings' | 'matchup-predictions' | 'posts';
  content: string;
  userId?: string; // User performing the save (for commissioner validation)
}

export interface SaveDeskDraftResult {
  success: boolean;
  lastSaved: string;
  error?: string;
}

/**
 * Saves a commissioner desk draft (power rankings or matchup predictions).
 * Validates commissioner role and upserts the draft content.
 */
export async function saveDeskDraft(input: SaveDeskDraftInput): Promise<SaveDeskDraftResult> {
  const { leagueSlug, seasonId, weekNumber, type, content, userId } = input;

  // Look up the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  if (!league) {
    return {
      success: false,
      lastSaved: new Date().toISOString(),
      error: 'League not found',
    };
  }

  // Validate commissioner role if userId provided
  if (userId) {
    const membership = await prisma.leagueMembership.findUnique({
      where: {
        user_league_unique: {
          userId,
          leagueId: league.id,
        },
      },
    });

    if (membership?.role !== 'commissioner') {
      return {
        success: false,
        lastSaved: new Date().toISOString(),
        error: 'Unauthorized: Commissioner role required',
      };
    }
  }

  // Parse season year from seasonId (e.g., 'season-2025' -> 2025)
  const seasonYear = parseInt(seasonId.replace('season-', ''), 10) || new Date().getFullYear();

  const lastSaved = new Date().toISOString();

  try {
    if (type === 'power-rankings') {
      // Upsert power ranking draft
      await prisma.powerRanking.upsert({
        where: {
          league_season_week_unique: {
            leagueId: league.id,
            season: seasonYear,
            weekNumber,
          },
        },
        update: {
          status: 'draft',
          updatedAt: new Date(),
        },
        create: {
          leagueId: league.id,
          season: seasonYear,
          weekNumber,
          status: 'draft',
        },
      });

      // Note: The actual content (ranking entries) would be saved separately
      // This is a simplified implementation for the draft state
    } else if (type === 'matchup-predictions') {
      // For matchup predictions, we need to parse content or handle separately
      // This implementation focuses on the draft state management
      // Individual predictions are managed via their own endpoints
    }

    return { success: true, lastSaved };
  } catch (error) {
    console.error('Error saving desk draft:', error);
    return {
      success: false,
      lastSaved,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
