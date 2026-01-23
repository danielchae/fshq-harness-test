// Comment deletion data layer
import { revalidatePath, revalidateTag } from 'next/cache';

import { requireLeagueAccess } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

export interface DeleteCommentInput {
  commentId: string;
  userId: string;
}

export interface DeleteCommentResult {
  success: boolean;
  error?: string;
}

/**
 * Deletes a comment.
 *
 * This function:
 * 1. Validates the comment exists
 * 2. Validates the user is the author of the comment
 * 3. Validates the user is still a member of the league
 * 4. Deletes all child comments (replies) first
 * 5. Deletes the comment
 *
 * @param input - The comment deletion input containing commentId and userId
 * @returns DeleteCommentResult with success status or error
 */
export async function deleteComment(input: DeleteCommentInput): Promise<DeleteCommentResult> {
  const { commentId, userId } = input;

  try {
    // 1. Find the comment and verify ownership
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        momentId: true,
        moment: {
          select: {
            leagueId: true,
            league: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!comment) {
      return { success: false, error: 'Comment not found' };
    }

    // 2. Verify the user is the author
    if (comment.authorId !== userId) {
      return { success: false, error: 'You can only delete your own comments' };
    }

    // 3. Verify user still has league access
    await requireLeagueAccess(userId, comment.moment.leagueId);

    // 4. Delete all child comments (replies) recursively
    // First get all descendant comment IDs
    const getAllDescendantIds = async (parentId: string): Promise<string[]> => {
      const children = await prisma.comment.findMany({
        where: { parentId },
        select: { id: true },
      });

      const childIds = children.map((c) => c.id);
      const descendantIds: string[] = [];

      for (const childId of childIds) {
        descendantIds.push(childId);
        const grandchildIds = await getAllDescendantIds(childId);
        descendantIds.push(...grandchildIds);
      }

      return descendantIds;
    };

    const descendantIds = await getAllDescendantIds(commentId);

    // Delete descendants first (children, grandchildren, etc.)
    if (descendantIds.length > 0) {
      await prisma.comment.deleteMany({
        where: { id: { in: descendantIds } },
      });
    }

    // 5. Delete the comment itself
    await prisma.comment.delete({
      where: { id: commentId },
    });

    // 6. Revalidate the moment detail page cache
    revalidatePath(`/leagues/${comment.moment.league.slug}/moments/${comment.momentId}`);
    revalidateTag(`feed-${comment.moment.league.slug}`, 'max');

    return { success: true };
  } catch (error) {
    console.error('[deleteComment] Error deleting comment:', error);
    return { success: false, error: 'Failed to delete comment. Please try again.' };
  }
}
