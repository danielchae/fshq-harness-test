/**
 * Hidden Moments Query and Actions
 *
 * Implements queries and actions for managing hidden moments.
 * Used by the moderation queue to view, unhide, or permanently delete hidden content.
 *
 * @module src/data/moderation/get-hidden-moments
 */

import { revalidatePath, revalidateTag } from 'next/cache';

import { canModerateLeague, RLSError } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

import type {
  DeleteMomentResponse,
  HiddenMoment,
  HiddenMomentsResponse,
  UnhideMomentResponse,
} from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface GetHiddenMomentsInput {
  leagueId: string;
  userId: string;
  contentType?: string;
  moderator?: string;
}

export interface UnhideMomentInput {
  momentId: string;
  userId: string;
}

export interface DeleteHiddenMomentInput {
  momentId: string;
  userId: string;
}

// ============================================================================
// Get Hidden Moments Query
// ============================================================================

/**
 * Retrieves all hidden moments for a league's moderation queue.
 *
 * Requirements:
 * - User must have admin or commissioner role in the league
 * - Returns moments with isHidden=true
 *
 * @param input - Query parameters including leagueId, userId, and optional filters
 * @returns HiddenMomentsResponse with array of hidden moments
 */
export async function getHiddenMoments(input: GetHiddenMomentsInput): Promise<HiddenMomentsResponse> {
  const { leagueId, userId, contentType, moderator } = input;

  try {
    // Validate user has moderation permissions (admin or commissioner)
    const canModerate = await canModerateLeague(userId, leagueId);
    if (!canModerate) {
      return { hiddenMoments: [] };
    }

    // Build filter conditions
    const whereConditions: Record<string, unknown> = {
      leagueId,
      isHidden: true,
    };

    // Filter by content type if specified
    if (contentType && contentType !== 'all') {
      whereConditions.type = contentType;
    }

    // Filter by moderator who hid the content
    if (moderator && moderator !== 'all') {
      whereConditions.hiddenById = moderator;
    }

    // Query hidden moments with author and moderator info
    const moments = await prisma.moment.findMany({
      where: whereConditions,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            avatarUrl: true,
          },
        },
        // Include the user who hid this moment
      },
      orderBy: {
        hiddenAt: 'desc',
      },
    });

    // Get moderator names for hidden moments
    const moderatorIds = [...new Set(moments.map((m) => m.hiddenById).filter(Boolean))] as string[];
    const moderators =
      moderatorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: moderatorIds } },
            select: { id: true, name: true },
          })
        : [];
    const moderatorMap = new Map(moderators.map((m) => [m.id, m.name]));

    // Transform to HiddenMoment type
    const hiddenMoments: HiddenMoment[] = moments.map((moment) => ({
      id: moment.id,
      content: moment.content ?? '',
      hideReason: moment.hideReason ?? 'Moderated by admin', // Use stored reason or default
      hiddenAt: (moment.hiddenAt ?? moment.updatedAt).toISOString(),
      hiddenBy: moment.hiddenById ? (moderatorMap.get(moment.hiddenById) ?? undefined) : undefined,
      authorId: moment.authorId,
      authorName: moment.author.name ?? undefined,
      authorAvatar: moment.author.avatarUrl ?? moment.author.image ?? undefined,
      type: moment.type as 'post' | 'trade' | 'comment',
      originalCreatedAt: moment.createdAt.toISOString(),
    }));

    return { hiddenMoments };
  } catch (error) {
    if (error instanceof RLSError) {
      console.error('[getHiddenMoments] RLS Error:', error.message);
      return { hiddenMoments: [] };
    }

    console.error('[getHiddenMoments] Error:', error);
    return { hiddenMoments: [] };
  }
}

// ============================================================================
// Unhide Moment Action
// ============================================================================

/**
 * Restores a hidden moment back to the public feed.
 *
 * Requirements:
 * - User must have admin or commissioner role in the league
 * - Moment must exist and be currently hidden
 *
 * @param input - The unhide input containing momentId and userId
 * @returns UnhideMomentResponse with success status
 */
export async function unhideMoment(input: UnhideMomentInput): Promise<UnhideMomentResponse> {
  const { momentId, userId } = input;

  try {
    // Get the moment to find its league
    const moment = await prisma.moment.findUnique({
      where: { id: momentId },
      select: {
        id: true,
        leagueId: true,
        isHidden: true,
        league: {
          select: { slug: true },
        },
      },
    });

    if (!moment) {
      return { success: false, error: 'Moment not found' };
    }

    // Check if already visible
    if (!moment.isHidden) {
      return { success: true };
    }

    // Validate user has moderation permissions (admin or commissioner)
    const canModerate = await canModerateLeague(userId, moment.leagueId);
    if (!canModerate) {
      return {
        success: false,
        error: 'You do not have permission to moderate this content',
      };
    }

    // Update the moment's hidden status and clear moderation fields
    await prisma.moment.update({
      where: { id: momentId },
      data: {
        isHidden: false,
        hiddenById: null,
        hideReason: null,
        hiddenAt: null,
      },
    });

    // Revalidate feed caches (paths for server components, tag for client-side fetches)
    revalidatePath(`/leagues/${moment.league.slug}`);
    revalidatePath(`/leagues/${moment.league.slug}/feed`);
    revalidatePath(`/leagues/${moment.league.slug}/moderation`);
    revalidateTag(`feed-${moment.league.slug}`);

    return { success: true };
  } catch (error) {
    if (error instanceof RLSError) {
      return { success: false, error: error.message };
    }

    console.error('[unhideMoment] Error:', error);
    return { success: false, error: 'Failed to unhide moment. Please try again.' };
  }
}

// ============================================================================
// Delete Hidden Moment Action (Permanent)
// ============================================================================

/**
 * Permanently deletes a hidden moment from the database.
 *
 * This is a destructive action that cannot be undone.
 * Use with caution - consider keeping moments hidden instead of deleting.
 *
 * Requirements:
 * - User must have admin or commissioner role in the league
 * - Moment must exist
 *
 * @param input - The delete input containing momentId and userId
 * @returns DeleteMomentResponse with success status
 */
export async function deleteHiddenMoment(input: DeleteHiddenMomentInput): Promise<DeleteMomentResponse> {
  const { momentId, userId } = input;

  try {
    // Get the moment to find its league
    const moment = await prisma.moment.findUnique({
      where: { id: momentId },
      select: {
        id: true,
        leagueId: true,
        league: {
          select: { slug: true },
        },
      },
    });

    if (!moment) {
      return { success: false, error: 'Moment not found' };
    }

    // Validate user has moderation permissions (admin or commissioner)
    const canModerate = await canModerateLeague(userId, moment.leagueId);
    if (!canModerate) {
      return {
        success: false,
        error: 'You do not have permission to delete this content',
      };
    }

    // Permanently delete the moment and all associated data (cascade handles comments/reactions)
    await prisma.moment.delete({
      where: { id: momentId },
    });

    // Revalidate feed caches (paths for server components, tag for client-side fetches)
    revalidatePath(`/leagues/${moment.league.slug}`);
    revalidatePath(`/leagues/${moment.league.slug}/feed`);
    revalidatePath(`/leagues/${moment.league.slug}/moderation`);
    revalidateTag(`feed-${moment.league.slug}`);

    return { success: true };
  } catch (error) {
    if (error instanceof RLSError) {
      return { success: false, error: error.message };
    }

    console.error('[deleteHiddenMoment] Error:', error);
    return { success: false, error: 'Failed to delete moment. Please try again.' };
  }
}
