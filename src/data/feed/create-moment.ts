// Create moment data layer
// Replaced with Prisma implementation (task-23)

import { revalidatePath } from 'next/cache';

import { getAccessibleLeagueBySlug, RLSError } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

import type { Moment } from '@/types/feed';

export interface CreateMomentInput {
  leagueSlug: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
}

export interface CreateMomentResult {
  success: boolean;
  moment?: Moment;
  error?: string;
}

/**
 * Creates a new moment (user-generated post) in a league.
 *
 * This function:
 * 1. Validates the content is not empty and within length limits
 * 2. Validates the user is an approved member of the league
 * 3. Creates the moment record in the database
 * 4. Revalidates the league feed cache for real-time updates
 *
 * @param input - The moment creation input containing leagueSlug, content, and author info
 * @returns CreateMomentResult with success status and the created moment or error
 */
export async function createMoment(input: CreateMomentInput): Promise<CreateMomentResult> {
  const { leagueSlug, content, authorId, authorName, authorAvatar } = input;

  // Validate content is not empty
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Post content cannot be empty' };
  }

  // Validate content length
  if (content.length > 5000) {
    return { success: false, error: 'Post exceeds maximum length of 5000 characters' };
  }

  try {
    // Validate user is a league member using RLS check
    // This throws RLSError if user is not an approved member
    const league = await getAccessibleLeagueBySlug(authorId, leagueSlug);

    // Create the moment record in the database
    const createdMoment = await prisma.moment.create({
      data: {
        leagueId: league.id,
        authorId,
        type: 'post',
        content: content.trim(),
        isPinned: false,
        isHidden: false,
        lastActivityAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Transform the Prisma result to match the Moment type expected by the frontend
    const moment: Moment = {
      id: createdMoment.id,
      type: 'post',
      content: createdMoment.content ?? undefined,
      createdAt: createdMoment.createdAt.toISOString(),
      authorId: createdMoment.authorId,
      authorName: createdMoment.author.name ?? authorName,
      authorAvatar: createdMoment.author.avatarUrl ?? createdMoment.author.image ?? authorAvatar,
      reactions: {},
      commentCount: 0,
      pinned: createdMoment.isPinned,
      hidden: createdMoment.isHidden,
    };

    // Update engagement metrics for the league (increment moments created)
    // We do this asynchronously to not block the response
    updateEngagementMetrics(league.id).catch((err) => {
      console.error('[createMoment] Failed to update engagement metrics:', err);
    });

    // Revalidate the league feed cache for real-time updates
    revalidatePath(`/leagues/${leagueSlug}`);
    revalidatePath(`/leagues/${leagueSlug}/feed`);

    return { success: true, moment };
  } catch (error) {
    // Handle RLS errors (user not a member)
    if (error instanceof RLSError) {
      return { success: false, error: error.message };
    }

    // Log unexpected errors
    console.error('[createMoment] Error creating moment:', error);
    return { success: false, error: 'Failed to create post. Please try again.' };
  }
}

/**
 * Updates engagement metrics for a league when a new moment is created.
 * This is called asynchronously to not block the main response.
 */
async function updateEngagementMetrics(leagueId: string): Promise<void> {
  // Get current week number (simplified - in production this would come from NFL state)
  const currentWeek = Math.ceil((Date.now() - new Date('2025-09-01').getTime()) / (7 * 24 * 60 * 60 * 1000));

  try {
    await prisma.engagementMetrics.upsert({
      where: {
        league_week_engagement_unique: {
          leagueId,
          weekNumber: currentWeek,
        },
      },
      update: {
        momentsCreated: {
          increment: 1,
        },
      },
      create: {
        leagueId,
        weekNumber: currentWeek,
        momentsCreated: 1,
        commentsCount: 0,
        reactionsCount: 0,
      },
    });
  } catch (err) {
    // Log but don't fail the main operation
    console.error('[updateEngagementMetrics] Error:', err);
  }
}
