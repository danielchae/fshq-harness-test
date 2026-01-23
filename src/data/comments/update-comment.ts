// Comment update data layer
import { revalidatePath, revalidateTag } from 'next/cache';

import { requireLeagueAccess } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

export interface UpdateCommentInput {
  commentId: string;
  content: string;
  userId: string;
}

export interface UpdateCommentResult {
  success: boolean;
  comment?: {
    id: string;
    content: string;
    isEdited: boolean;
  };
  error?: string;
}

/**
 * Updates a comment's content.
 *
 * This function:
 * 1. Validates the content is not empty and within length limits
 * 2. Validates the comment exists
 * 3. Validates the user is the author of the comment
 * 4. Validates the user is still a member of the league
 * 5. Updates the comment content and marks it as edited
 *
 * @param input - The comment update input containing commentId, content, and userId
 * @returns UpdateCommentResult with success status and the updated comment or error
 */
export async function updateComment(input: UpdateCommentInput): Promise<UpdateCommentResult> {
  const { commentId, content, userId } = input;

  // Validate content is not empty
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Comment content cannot be empty' };
  }

  // Validate content length
  if (content.length > 2000) {
    return { success: false, error: 'Comment exceeds maximum length of 2000 characters' };
  }

  try {
    // 1. Find the comment and verify ownership
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
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
      return { success: false, error: 'You can only edit your own comments' };
    }

    // 3. Verify user still has league access
    await requireLeagueAccess(userId, comment.moment.leagueId);

    // 4. Update the comment
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        isEdited: true,
      },
      select: {
        id: true,
        content: true,
        isEdited: true,
        momentId: true,
      },
    });

    // 5. Revalidate the moment detail page cache
    revalidatePath(`/leagues/${comment.moment.league.slug}/moments/${updatedComment.momentId}`);
    revalidateTag(`feed-${comment.moment.league.slug}`);

    return {
      success: true,
      comment: {
        id: updatedComment.id,
        content: updatedComment.content,
        isEdited: updatedComment.isEdited,
      },
    };
  } catch (error) {
    console.error('[updateComment] Error updating comment:', error);
    return { success: false, error: 'Failed to update comment. Please try again.' };
  }
}
