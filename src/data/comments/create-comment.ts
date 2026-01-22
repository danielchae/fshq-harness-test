// Comment creation data layer
// Replaced with Prisma implementation (task-24)

import { revalidatePath, revalidateTag } from 'next/cache';

import { checkLeagueMembership, requireLeagueAccess, RLSError } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';
import { getCurrentNFLWeek } from '@/lib/nfl-week';

import type { Comment } from '@/types/feed';

export interface CreateCommentInput {
  momentId: string;
  content: string;
  parentId?: string;
  authorId: string;
}

export interface CreateCommentResult {
  success: boolean;
  comment?: Comment;
  error?: string;
}

/**
 * Creates a new comment on a moment.
 *
 * This function:
 * 1. Validates the content is not empty and within length limits
 * 2. Validates the moment exists and is accessible
 * 3. Validates the user is an approved member of the league
 * 4. Creates the comment record in the database
 * 5. Updates moment's lastActivityAt timestamp
 * 6. Updates engagement metrics for the league
 * 7. Optionally creates a notification for the moment author
 *
 * @param input - The comment creation input containing momentId, content, authorId, and optional parentId
 * @returns CreateCommentResult with success status and the created comment or error
 */
export async function createComment(input: CreateCommentInput): Promise<CreateCommentResult> {
  const { momentId, content, parentId, authorId } = input;

  // Validate content is not empty
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Comment content cannot be empty' };
  }

  // Validate content length
  if (content.length > 2000) {
    return { success: false, error: 'Comment exceeds maximum length of 2000 characters' };
  }

  try {
    // 1. Validate moment exists and get league info
    const moment = await prisma.moment.findUnique({
      where: { id: momentId },
      select: {
        id: true,
        authorId: true,
        leagueId: true,
        league: {
          select: {
            slug: true,
          },
        },
      },
    });

    if (!moment) {
      return { success: false, error: 'Moment not found' };
    }

    // 2. Validate user is a league member using RLS check
    // This throws RLSError if user is not an approved member
    await requireLeagueAccess(authorId, moment.leagueId);

    // 3. If parentId provided, validate parent comment exists and belongs to same moment
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { momentId: true },
      });

      if (!parentComment) {
        return { success: false, error: 'Parent comment not found' };
      }

      if (parentComment.momentId !== momentId) {
        return { success: false, error: 'Parent comment does not belong to this moment' };
      }
    }

    // 4. Get user's membership to determine role
    const membership = await checkLeagueMembership(authorId, moment.leagueId);

    // 5. Create the comment record in the database
    const createdComment = await prisma.comment.create({
      data: {
        content: content.trim(),
        authorId,
        momentId,
        parentId: parentId ?? null,
        isEdited: false,
        isHidden: false,
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

    // 6. Update moment's lastActivityAt to track engagement
    await prisma.moment.update({
      where: { id: momentId },
      data: {
        lastActivityAt: new Date(),
      },
    });

    // 7. Update engagement metrics asynchronously
    updateEngagementMetrics(moment.leagueId).catch((err) => {
      console.error('[createComment] Failed to update engagement metrics:', err);
    });

    // 8. Create notification for moment author if not commenting on own moment
    if (moment.authorId !== authorId) {
      createCommentNotification(moment.authorId, authorId, momentId, createdComment.id).catch((err) => {
        console.error('[createComment] Failed to create notification:', err);
      });
    }

    // Transform the Prisma result to match the Comment type expected by the frontend
    const roleDisplay = membership.role ? membership.role.charAt(0).toUpperCase() + membership.role.slice(1) : 'Member';

    const comment: Comment = {
      id: createdComment.id,
      content: createdComment.content,
      author: createdComment.author.name ?? 'Unknown User',
      authorAvatar: createdComment.author.avatarUrl ?? createdComment.author.image ?? undefined,
      authorRole: roleDisplay,
      createdAt: createdComment.createdAt.toISOString(),
      parentId: createdComment.parentId ?? undefined,
      isOwner: true, // The creator is always the owner
      isEdited: createdComment.isEdited,
    };

    // Revalidate the moment detail page cache
    revalidatePath(`/leagues/${moment.league.slug}/moments/${momentId}`);
    revalidateTag(`feed-${moment.league.slug}`, 'max');

    return { success: true, comment };
  } catch (error) {
    // Handle RLS errors (user not a member)
    if (error instanceof RLSError) {
      return { success: false, error: error.message };
    }

    // Log unexpected errors
    console.error('[createComment] Error creating comment:', error);
    return { success: false, error: 'Failed to create comment. Please try again.' };
  }
}

/**
 * Updates engagement metrics for a league when a new comment is created.
 * This is called asynchronously to not block the main response.
 */
async function updateEngagementMetrics(leagueId: string): Promise<void> {
  // Get current week number from NFL state
  const currentWeek = await getCurrentNFLWeek();

  try {
    await prisma.engagementMetrics.upsert({
      where: {
        league_week_engagement_unique: {
          leagueId,
          weekNumber: currentWeek,
        },
      },
      update: {
        commentsCount: {
          increment: 1,
        },
      },
      create: {
        leagueId,
        weekNumber: currentWeek,
        momentsCreated: 0,
        commentsCount: 1,
        reactionsCount: 0,
      },
    });
  } catch (err) {
    // Log but don't fail the main operation
    console.error('[updateEngagementMetrics] Error:', err);
  }
}

/**
 * Creates a notification for the moment author when someone comments on their moment.
 * This is called asynchronously to not block the main response.
 */
async function createCommentNotification(
  recipientId: string,
  commenterId: string,
  momentId: string,
  _commentId: string
): Promise<void> {
  try {
    // Get commenter info for notification message
    const commenter = await prisma.user.findUnique({
      where: { id: commenterId },
      select: { name: true },
    });

    // Get moment info for the notification link
    const moment = await prisma.moment.findUnique({
      where: { id: momentId },
      include: { league: { select: { slug: true } } },
    });

    if (!moment?.league?.slug) {
      console.warn('[createCommentNotification] Could not find league slug for moment');
      return;
    }

    const commenterName = commenter?.name ?? 'Someone';

    // Use the notification service
    const { notifyCommentReply } = await import('@/lib/notifications');
    await notifyCommentReply(recipientId, moment.league.slug, momentId, commenterName);
  } catch (err) {
    // Log but don't fail the main operation
    console.error('[createCommentNotification] Error:', err);
  }
}
