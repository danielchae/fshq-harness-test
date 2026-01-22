'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { authActionClient } from '@/actions/safe-action';
import { requireCommissioner } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

import type { PublishResponse, ValidationError, ValidationResult } from '@/types/publish';

// Schema for publish content request
const publishContentSchema = z.object({
  leagueSlug: z.string().min(1),
  seasonId: z.string().min(1),
  weekNumber: z.number().int().positive(),
  skipSections: z.array(z.enum(['power-rankings', 'matchup-predictions', 'posts'])).optional(),
});

/**
 * Validate power rankings are complete and ready for publishing
 * - Must exist for the week
 * - Must have at least one team ranked
 * - All teams should have commentary
 */
async function validatePowerRankingsFromDb(
  leagueId: string,
  season: number,
  weekNumber: number
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Find the power ranking for this week
  const powerRanking = await prisma.powerRanking.findUnique({
    where: {
      league_season_week_unique: {
        leagueId,
        season,
        weekNumber,
      },
    },
    include: {
      entries: {
        include: {
          team: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!powerRanking) {
    errors.push({
      section: 'power-rankings',
      message: 'Power rankings not found',
      details: 'Please create power rankings before publishing.',
    });
    return errors;
  }

  // Check that at least one team is ranked
  if (powerRanking.entries.length === 0) {
    errors.push({
      section: 'power-rankings',
      message: 'No teams ranked',
      details: 'Please rank at least one team.',
    });
    return errors;
  }

  // Check for missing commentary
  const entriesWithoutCommentary = powerRanking.entries.filter(
    (entry) => !entry.commentary || entry.commentary.trim().length === 0
  );

  if (entriesWithoutCommentary.length > 0) {
    const teamNames = entriesWithoutCommentary.map((e) => e.team.name).join(', ');
    errors.push({
      section: 'power-rankings',
      message: 'Incomplete power rankings',
      details: `Missing commentary for: ${teamNames}. Add commentary for all ranked teams before publishing.`,
    });
  }

  return errors;
}

/**
 * Validate matchup predictions are complete and ready for publishing
 * - Must have a featured matchup selected
 * - Featured matchup must have hype text
 */
async function validateMatchupPredictionsFromDb(
  leagueId: string,
  season: number,
  weekNumber: number
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Find all predictions for this week
  const predictions = await prisma.matchupPrediction.findMany({
    where: {
      leagueId,
      season,
      weekNumber,
    },
  });

  if (predictions.length === 0) {
    errors.push({
      section: 'matchup-predictions',
      message: 'Matchup predictions not found',
      details: 'Please create matchup predictions before publishing.',
    });
    return errors;
  }

  // Check for featured matchup
  const featuredPrediction = predictions.find((p) => p.isFeatured);

  if (!featuredPrediction) {
    errors.push({
      section: 'matchup-predictions',
      message: 'No featured matchup selected',
      details: 'Please select a matchup of the week before publishing.',
    });
  } else if (!featuredPrediction.hypeText || featuredPrediction.hypeText.trim().length === 0) {
    errors.push({
      section: 'matchup-predictions',
      message: 'Featured matchup missing hype text',
      details: 'Please add hype text for the matchup of the week.',
    });
  }

  return errors;
}

/**
 * Validate all content sections before publishing
 */
async function validateContentFromDb(
  leagueId: string,
  season: number,
  weekNumber: number,
  skipSections: ('power-rankings' | 'matchup-predictions' | 'posts')[] = []
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Validate power rankings if not skipped
  if (!skipSections.includes('power-rankings')) {
    const rankingsErrors = await validatePowerRankingsFromDb(leagueId, season, weekNumber);
    errors.push(...rankingsErrors);
  }

  // Validate matchup predictions if not skipped
  if (!skipSections.includes('matchup-predictions')) {
    const predictionsErrors = await validateMatchupPredictionsFromDb(leagueId, season, weekNumber);
    errors.push(...predictionsErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Publish Content Server Action
 *
 * Atomically publishes commissioner desk content:
 * - Validates user has commissioner role
 * - Validates power rankings and matchup predictions data
 * - Updates status from 'draft' to 'published' with timestamp
 * - Creates feed moments for published content
 * - Returns PublishResponse with validation results
 */
export const publishContentAction = authActionClient
  .schema(publishContentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { leagueSlug, seasonId, weekNumber, skipSections = [] } = parsedInput;
    const { userId } = ctx;

    // Get the league by slug
    const league = await prisma.league.findUnique({
      where: { slug: leagueSlug },
    });

    if (!league) {
      return {
        success: false,
        error: 'League not found',
      } satisfies PublishResponse;
    }

    // Validate commissioner role
    try {
      await requireCommissioner(userId, league.id);
    } catch {
      return {
        success: false,
        error: 'You must be a commissioner to publish content',
      } satisfies PublishResponse;
    }

    // Extract season number from seasonId (e.g., "season-2025" -> 2025)
    const season = parseInt(seasonId.replace('season-', ''), 10) || league.season;

    // Run validation first
    const validation = await validateContentFromDb(league.id, season, weekNumber, skipSections);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors[0]?.message || 'Validation failed',
      } satisfies PublishResponse;
    }

    const publishedAt = new Date();
    let feedMomentsCreated = 0;

    try {
      // Use transaction for atomic update
      await prisma.$transaction(async (tx) => {
        // Publish power rankings if not skipped
        if (!skipSections.includes('power-rankings')) {
          const powerRanking = await tx.powerRanking.findUnique({
            where: {
              league_season_week_unique: {
                leagueId: league.id,
                season,
                weekNumber,
              },
            },
            include: {
              entries: {
                include: {
                  team: {
                    select: {
                      name: true,
                    },
                  },
                },
                orderBy: {
                  rank: 'asc',
                },
                take: 3, // Top 3 for moment content
              },
            },
          });

          if (powerRanking) {
            // Update status to published
            await tx.powerRanking.update({
              where: { id: powerRanking.id },
              data: {
                status: 'published',
                publishedAt,
                publishedByUserId: userId,
              },
            });

            // Create rankings feed moment
            const topTeams = powerRanking.entries.map((e) => e.team.name).join(', ');
            await tx.moment.create({
              data: {
                leagueId: league.id,
                authorId: userId,
                type: 'rankings',
                content: JSON.stringify({
                  weekNumber,
                  season,
                  message: `Week ${weekNumber} Power Rankings are live! Top 3: ${topTeams}`,
                  powerRankingId: powerRanking.id,
                }),
              },
            });
            feedMomentsCreated++;
          }
        }

        // Publish matchup predictions if not skipped
        if (!skipSections.includes('matchup-predictions')) {
          const predictions = await tx.matchupPrediction.findMany({
            where: {
              leagueId: league.id,
              season,
              weekNumber,
            },
            include: {
              matchup: {
                include: {
                  homeTeam: { select: { name: true } },
                  awayTeam: { select: { name: true } },
                },
              },
            },
          });

          if (predictions.length > 0) {
            // Update all predictions to published
            await tx.matchupPrediction.updateMany({
              where: {
                leagueId: league.id,
                season,
                weekNumber,
              },
              data: {
                status: 'published',
                publishedAt,
                publishedByUserId: userId,
              },
            });

            // Find featured matchup for the moment
            const featured = predictions.find((p) => p.isFeatured);
            if (featured) {
              const matchupName = `${featured.matchup.awayTeam.name} @ ${featured.matchup.homeTeam.name}`;
              await tx.moment.create({
                data: {
                  leagueId: league.id,
                  authorId: userId,
                  type: 'prediction',
                  content: JSON.stringify({
                    weekNumber,
                    season,
                    message: `Matchup of the Week: ${matchupName}`,
                    hypeText: featured.hypeText,
                    matchupId: featured.matchupId,
                  }),
                },
              });
              feedMomentsCreated++;
            }
          }
        }
      });

      // Revalidate cache for all affected pages
      revalidatePath(`/leagues/${leagueSlug}/desk`);
      revalidatePath(`/leagues/${leagueSlug}/rankings`);
      revalidatePath(`/leagues/${leagueSlug}/matchups`);
      revalidatePath(`/leagues/${leagueSlug}/feed`);

      // Return success with links
      return {
        success: true,
        rankingsUrl: `/leagues/${leagueSlug}/rankings`,
        feedUrl: `/leagues/${leagueSlug}/feed`,
        matchupsUrl: `/leagues/${leagueSlug}/matchups`,
        publishedAt: publishedAt.toISOString(),
        feedMomentsCreated,
      } satisfies PublishResponse;
    } catch (error) {
      console.error('Publish error:', error);
      return {
        success: false,
        error: 'Failed to publish content. Please try again.',
      } satisfies PublishResponse;
    }
  });

// Re-export validation functions for use by the data layer
export { validatePowerRankingsFromDb, validateMatchupPredictionsFromDb, validateContentFromDb };
