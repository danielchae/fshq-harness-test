/**
 * Moderation Server Actions
 *
 * Implements commissioner/admin moderation controls for moments.
 * Validates user role before allowing pin/hide/delete operations.
 *
 * @module src/data/moderation/moderate-moment
 */

import { revalidatePath, revalidateTag } from 'next/cache';

import { canModerateLeague, RLSError } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface PinMomentInput {
  momentId: string;
  pin: boolean;
  userId: string;
}

export interface HideMomentInput {
  momentId: string;
  userId: string;
  reason?: string;
}

export interface DeleteMomentInput {
  momentId: string;
  userId: string;
  hardDelete?: boolean; // If true, permanently deletes; otherwise soft-deletes (hides)
}

export interface ModerationResult {
  success: boolean;
  pinned?: boolean;
  hidden?: boolean;
  deleted?: boolean;
  error?: string;
}

// ============================================================================
// Pin Moment Action
// ============================================================================

/**
 * Pins or unpins a moment to the top of the feed.
 *
 * Requirements:
 * - User must have admin or commissioner role in the league
 * - Moment must exist and belong to a valid league
 *
 * @param input - The pin moment input containing momentId, pin state, and userId
 * @returns ModerationResult with success status
 */
export async function pinMoment(input: PinMomentInput): Promise<ModerationResult> {
  const { momentId, pin, userId } = input;

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
        error: 'You do not have permission to moderate this content',
      };
    }

    // Update the moment's pinned status
    await prisma.moment.update({
      where: { id: momentId },
      data: {
        isPinned: pin,
        pinnedById: pin ? userId : null,
      },
    });

    // Revalidate feed caches (paths for server components, tag for client-side fetches)
    revalidatePath(`/leagues/${moment.league.slug}`);
    revalidatePath(`/leagues/${moment.league.slug}/feed`);
    revalidateTag(`feed-${moment.league.slug}`, 'max');

    return { success: true, pinned: pin };
  } catch (error) {
    if (error instanceof RLSError) {
      return { success: false, error: error.message };
    }

    console.error('[pinMoment] Error:', error);
    return { success: false, error: 'Failed to update pin status. Please try again.' };
  }
}

// ============================================================================
// Hide Moment Action
// ============================================================================

/**
 * Hides a moment from the public feed.
 *
 * Requirements:
 * - User must have admin or commissioner role in the league
 * - Moment must exist and belong to a valid league
 *
 * @param input - The hide moment input containing momentId and userId
 * @returns ModerationResult with success status
 */
export async function hideMoment(input: HideMomentInput): Promise<ModerationResult> {
  const { momentId, userId, reason } = input;

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

    // Check if already hidden
    if (moment.isHidden) {
      return { success: true, hidden: true };
    }

    // Validate user has moderation permissions (admin or commissioner)
    const canModerate = await canModerateLeague(userId, moment.leagueId);
    if (!canModerate) {
      return {
        success: false,
        error: 'You do not have permission to moderate this content',
      };
    }

    // Update the moment's hidden status with reason and timestamp
    await prisma.moment.update({
      where: { id: momentId },
      data: {
        isHidden: true,
        hiddenById: userId,
        hideReason: reason ?? 'Moderated by admin',
        hiddenAt: new Date(),
      },
    });

    // Revalidate feed caches (paths for server components, tag for client-side fetches)
    revalidatePath(`/leagues/${moment.league.slug}`);
    revalidatePath(`/leagues/${moment.league.slug}/feed`);
    revalidatePath(`/leagues/${moment.league.slug}/moderation`);
    revalidateTag(`feed-${moment.league.slug}`, 'max');

    return { success: true, hidden: true };
  } catch (error) {
    if (error instanceof RLSError) {
      return { success: false, error: error.message };
    }

    console.error('[hideMoment] Error:', error);
    return { success: false, error: 'Failed to hide moment. Please try again.' };
  }
}

// ============================================================================
// Delete Moment Action
// ============================================================================

/**
 * Deletes a moment from the feed.
 *
 * By default, performs a soft-delete (hides the moment).
 * If hardDelete is true, permanently removes the moment and associated data.
 *
 * Requirements:
 * - User must have admin or commissioner role in the league
 * - Moment must exist and belong to a valid league
 *
 * @param input - The delete moment input containing momentId, userId, and optional hardDelete flag
 * @returns ModerationResult with success status
 */
export async function deleteMoment(input: DeleteMomentInput): Promise<ModerationResult> {
  const { momentId, userId, hardDelete = false } = input;

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

    if (hardDelete) {
      // Permanently delete the moment and all associated data (cascade)
      await prisma.moment.delete({
        where: { id: momentId },
      });
    } else {
      // Soft-delete: hide the moment with timestamp
      await prisma.moment.update({
        where: { id: momentId },
        data: {
          isHidden: true,
          hiddenById: userId,
          hideReason: 'Deleted by moderator',
          hiddenAt: new Date(),
        },
      });
    }

    // Revalidate feed caches (paths for server components, tag for client-side fetches)
    revalidatePath(`/leagues/${moment.league.slug}`);
    revalidatePath(`/leagues/${moment.league.slug}/feed`);
    revalidatePath(`/leagues/${moment.league.slug}/moderation`);
    revalidateTag(`feed-${moment.league.slug}`, 'max');

    return { success: true, deleted: true };
  } catch (error) {
    if (error instanceof RLSError) {
      return { success: false, error: error.message };
    }

    console.error('[deleteMoment] Error:', error);
    return { success: false, error: 'Failed to delete moment. Please try again.' };
  }
}
