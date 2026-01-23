// Toggle Reaction Data Layer
// Replaced with Prisma implementation (task-25)

import { revalidateTag } from 'next/cache';

import { requireLeagueAccess, RLSError } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';
import { getCurrentNFLWeek } from '@/lib/nfl-week';

export interface ToggleReactionInput {
  targetId: string;
  targetType: 'moment' | 'comment';
  emoji: string;
  userId: string;
}

export interface ToggleReactionResult {
  success: boolean;
  action: 'added' | 'removed';
  emoji: string;
  newCount: number;
  error?: string;
}

/**
 * Toggles a reaction on a moment.
 *
 * This function:
 * 1. Validates the target (moment) exists and is accessible
 * 2. Validates the user is an approved member of the league
 * 3. Creates or deletes the reaction record (toggle behavior)
 * 4. Returns the result with the new reaction count
 * 5. Updates engagement metrics for the league
 *
 * @param input - The toggle reaction input containing targetId, targetType, emoji, and userId
 * @returns ToggleReactionResult with success status, action taken, and new count
 */
export async function toggleReaction(input: ToggleReactionInput): Promise<ToggleReactionResult> {
  const { targetId, targetType, emoji, userId } = input;

  // Validate emoji is provided
  if (!emoji || emoji.trim().length === 0) {
    return { success: false, action: 'added', emoji, newCount: 0, error: 'Emoji is required' };
  }

  // Currently only supporting moment reactions (comments not yet fully integrated)
  if (targetType !== 'moment') {
    return {
      success: false,
      action: 'added',
      emoji,
      newCount: 0,
      error: 'Only moment reactions are supported at this time',
    };
  }

  try {
    // 1. Validate moment exists and get league info
    const moment = await prisma.moment.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        leagueId: true,
        league: {
          select: { slug: true },
        },
      },
    });

    if (!moment) {
      return { success: false, action: 'added', emoji, newCount: 0, error: 'Moment not found' };
    }

    // 2. Validate user is a league member
    try {
      await requireLeagueAccess(userId, moment.leagueId);
    } catch (error) {
      if (error instanceof RLSError) {
        return { success: false, action: 'added', emoji, newCount: 0, error: error.message };
      }
      throw error;
    }

    // 3. Check if user already has this reaction on this moment
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        user_moment_reaction_unique: {
          userId,
          momentId: targetId,
          reactionType: emoji,
        },
      },
    });

    let action: 'added' | 'removed';

    if (existingReaction) {
      // 4a. Delete the existing reaction (toggle off)
      await prisma.reaction.delete({
        where: { id: existingReaction.id },
      });
      action = 'removed';
    } else {
      // 4b. Create new reaction (toggle on)
      await prisma.reaction.create({
        data: {
          userId,
          momentId: targetId,
          reactionType: emoji,
        },
      });
      action = 'added';
    }

    // 5. Get the updated count for this reaction type on this moment
    const newCount = await prisma.reaction.count({
      where: {
        momentId: targetId,
        reactionType: emoji,
      },
    });

    // 6. Update moment's lastActivityAt to track engagement
    await prisma.moment.update({
      where: { id: targetId },
      data: {
        lastActivityAt: new Date(),
      },
    });

    // 7. Invalidate feed cache since lastActivityAt affects "recent" sort order
    if (moment.league?.slug) {
      revalidateTag(`feed-${moment.league.slug}`);
    }

    // 8. Update engagement metrics asynchronously (don't block the response)
    updateEngagementMetrics(moment.leagueId, action).catch((err) => {
      console.error('[toggleReaction] Failed to update engagement metrics:', err);
    });

    return {
      success: true,
      action,
      emoji,
      newCount,
    };
  } catch (error) {
    // Log unexpected errors
    console.error('[toggleReaction] Error toggling reaction:', error);
    return {
      success: false,
      action: 'added',
      emoji,
      newCount: 0,
      error: 'Failed to toggle reaction. Please try again.',
    };
  }
}

/**
 * Gets the user's reactions for a specific target (moment).
 *
 * @param targetId - The moment ID
 * @param targetType - The type of target ('moment' or 'comment')
 * @param userId - The user ID
 * @returns Array of emoji reaction types the user has added
 */
export async function getUserReactionsForTarget(
  targetId: string,
  targetType: 'moment' | 'comment',
  userId?: string
): Promise<string[]> {
  // If no userId, return empty array
  if (!userId) {
    return [];
  }

  // Currently only supporting moment reactions
  if (targetType !== 'moment') {
    return [];
  }

  try {
    const reactions = await prisma.reaction.findMany({
      where: {
        momentId: targetId,
        userId,
      },
      select: {
        reactionType: true,
      },
    });

    return reactions.map((r) => r.reactionType);
  } catch (error) {
    console.error('[getUserReactionsForTarget] Error fetching user reactions:', error);
    return [];
  }
}

/**
 * Gets all reaction counts for a specific target (moment).
 *
 * @param targetId - The moment ID
 * @param targetType - The type of target ('moment' or 'comment')
 * @returns Record of emoji -> count
 */
export async function getReactionCounts(
  targetId: string,
  targetType: 'moment' | 'comment'
): Promise<Record<string, number>> {
  // Currently only supporting moment reactions
  if (targetType !== 'moment') {
    return {};
  }

  try {
    const reactions = await prisma.reaction.groupBy({
      by: ['reactionType'],
      where: {
        momentId: targetId,
      },
      _count: {
        reactionType: true,
      },
    });

    const counts: Record<string, number> = {};
    for (const r of reactions) {
      counts[r.reactionType] = r._count.reactionType;
    }

    return counts;
  } catch (error) {
    console.error('[getReactionCounts] Error fetching reaction counts:', error);
    return {};
  }
}

/**
 * Updates engagement metrics for a league when a reaction is toggled.
 * This is called asynchronously to not block the main response.
 */
async function updateEngagementMetrics(leagueId: string, action: 'added' | 'removed'): Promise<void> {
  // Get current week number from NFL state
  const currentWeek = await getCurrentNFLWeek();

  try {
    if (action === 'added') {
      // Increment reaction count
      await prisma.engagementMetrics.upsert({
        where: {
          league_week_engagement_unique: {
            leagueId,
            weekNumber: currentWeek,
          },
        },
        update: {
          reactionsCount: {
            increment: 1,
          },
        },
        create: {
          leagueId,
          weekNumber: currentWeek,
          momentsCreated: 0,
          commentsCount: 0,
          reactionsCount: 1,
        },
      });
    } else {
      // Decrement reaction count (but don't go below 0)
      const existing = await prisma.engagementMetrics.findUnique({
        where: {
          league_week_engagement_unique: {
            leagueId,
            weekNumber: currentWeek,
          },
        },
        select: { reactionsCount: true },
      });

      if (existing && existing.reactionsCount > 0) {
        await prisma.engagementMetrics.update({
          where: {
            league_week_engagement_unique: {
              leagueId,
              weekNumber: currentWeek,
            },
          },
          data: {
            reactionsCount: {
              decrement: 1,
            },
          },
        });
      }
    }
  } catch (err) {
    // Log but don't fail the main operation
    console.error('[updateEngagementMetrics] Error:', err);
  }
}
