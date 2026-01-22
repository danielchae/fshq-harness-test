// Moment detail data layer
// Prisma implementation for task-47

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

import type { Comment, MomentDetail, MomentType } from '@/types/feed';

export interface GetMomentDetailInput {
  momentId: string;
  userId?: string; // Optional: for role checking (commissioners can see hidden moments)
  isCommissioner?: boolean; // Optional: if true, can see hidden moments
}

/**
 * Builds a comment tree from flat comments array.
 * Returns top-level comments with nested replies.
 */
function buildCommentTree(
  comments: Array<{
    id: string;
    content: string;
    authorId: string;
    parentId: string | null;
    isEdited: boolean;
    createdAt: Date;
    author: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
      image: string | null;
    };
  }>,
  currentUserId?: string
): Comment[] {
  // Create a map of all comments
  const commentMap = new Map<string, Comment>();

  // First pass: create Comment objects
  for (const c of comments) {
    commentMap.set(c.id, {
      id: c.id,
      content: c.content,
      author: c.author.name || 'Unknown',
      authorAvatar: c.author.avatarUrl || c.author.image || undefined,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parentId || undefined,
      isOwner: currentUserId ? c.authorId === currentUserId : false,
      isEdited: c.isEdited,
    });
  }

  // Return all comments (frontend can filter by parentId if needed)
  // The type contract expects a flat array with parentId for threading
  return Array.from(commentMap.values());
}

/**
 * Aggregates reactions into a Record<string, number> format.
 */
function aggregateReactions(
  reactions: Array<{ reactionType: string }>
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const r of reactions) {
    counts[r.reactionType] = (counts[r.reactionType] || 0) + 1;
  }

  return counts;
}

/**
 * Gets user's reactions for a moment.
 */
function getUserReactions(
  reactions: Array<{ userId: string; reactionType: string }>,
  userId?: string
): string[] {
  if (!userId) return [];
  return reactions
    .filter(r => r.userId === userId)
    .map(r => r.reactionType);
}

/**
 * Internal fetcher function that queries Prisma.
 */
async function fetchMomentDetail(
  momentId: string,
  userId?: string,
  isCommissioner?: boolean
): Promise<MomentDetail | null> {
  // Query moment with all related data
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          image: true,
        },
      },
      comments: {
        where: {
          isHidden: false, // Only show non-hidden comments
        },
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              image: true,
            },
          },
        },
      },
      reactions: {
        select: {
          userId: true,
          reactionType: true,
        },
      },
    },
  });

  if (!moment) {
    return null;
  }

  // Check if moment is hidden and user is not commissioner
  if (moment.isHidden && !isCommissioner) {
    return null;
  }

  // Build the MomentDetail response matching the frontend type contract
  const commentTree = buildCommentTree(moment.comments, userId);
  const reactionCounts = aggregateReactions(moment.reactions);
  const userReactions = getUserReactions(moment.reactions, userId);

  const momentDetail: MomentDetail = {
    id: moment.id,
    type: moment.type.toLowerCase() as MomentType,
    content: moment.content || undefined,
    createdAt: moment.createdAt.toISOString(),
    authorId: moment.authorId,
    authorName: moment.author.name || undefined,
    authorAvatar: moment.author.avatarUrl || moment.author.image || undefined,
    reactions: reactionCounts,
    userReactions: userReactions.length > 0 ? userReactions : undefined,
    commentCount: moment.comments.length,
    pinned: moment.isPinned,
    hidden: moment.isHidden,
    comments: commentTree,
  };

  return momentDetail;
}

/**
 * Gets moment detail with full comments tree and reaction counts.
 * Uses unstable_cache for Next.js caching with tag-based invalidation.
 */
export async function getMomentDetail(input: GetMomentDetailInput): Promise<MomentDetail | null> {
  const { momentId, userId, isCommissioner } = input;

  // Use cached version for performance
  const getCachedMomentDetail = unstable_cache(
    () => fetchMomentDetail(momentId, userId, isCommissioner),
    [`moment-detail-${momentId}-${userId || 'anon'}-${isCommissioner ? 'comm' : 'user'}`],
    {
      tags: [`moment-${momentId}`],
      revalidate: 60, // Revalidate every 60 seconds
    }
  );

  return getCachedMomentDetail();
}
