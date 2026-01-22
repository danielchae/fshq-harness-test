/**
 * Feed Data Fetcher
 *
 * Fetches league moments with reactions and comments using Prisma.
 * Implements RLS by checking user's role in league.
 *
 * @module src/data/feed/get-feed
 */

import { unstable_cache } from 'next/cache';

import { auth } from '@/lib/auth';
import { getUserRoleBySlug, hasRolePermission } from '@/lib/auth/rls-policies';
import { prisma } from '@/lib/db';

import type { FeedResponse, GetFeedInput, Moment, MomentType } from '@/types/feed';

/**
 * Default page size for feed queries
 */
const DEFAULT_LIMIT = 20;

/**
 * Aggregate reaction counts by reaction type for a moment
 */
function aggregateReactions(reactions: { reactionType: string }[]): Record<string, number> {
  return reactions.reduce(
    (acc, reaction) => {
      acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Get reactions the current user has made on a moment
 */
function getUserReactionTypes(
  reactions: { reactionType: string; userId: string }[],
  userId: string | undefined
): string[] {
  if (!userId) return [];
  return reactions.filter((r) => r.userId === userId).map((r) => r.reactionType);
}

/**
 * Type for Prisma Moment with included relations
 */
interface PrismaMomentWithRelations {
  id: string;
  type: MomentType;
  content: string | null;
  createdAt: Date;
  authorId: string;
  isPinned: boolean;
  isHidden: boolean;
  author: { id: string; name: string | null; image: string | null };
  reactions: { reactionType: string; userId: string }[];
  _count: { comments: number };
}

/**
 * Maps a Prisma Moment with included data to the Moment type contract
 */
function mapPrismaToMoment(prismaMoment: PrismaMomentWithRelations, currentUserId: string | undefined): Moment {
  return {
    id: prismaMoment.id,
    type: prismaMoment.type,
    content: prismaMoment.content ?? undefined,
    createdAt: prismaMoment.createdAt.toISOString(),
    authorId: prismaMoment.authorId,
    authorName: prismaMoment.author.name ?? undefined,
    authorAvatar: prismaMoment.author.image ?? undefined,
    reactions: aggregateReactions(prismaMoment.reactions),
    userReactions: getUserReactionTypes(prismaMoment.reactions, currentUserId),
    commentCount: prismaMoment._count.comments,
    pinned: prismaMoment.isPinned,
    hidden: prismaMoment.isHidden,
  };
}

/**
 * Core feed fetching logic - fetches moments from database
 */
async function fetchFeedFromDb(
  leagueSlug: string,
  options: {
    cursor?: string;
    limit: number;
    type?: MomentType;
    sort?: 'recent' | 'chronological';
    showHidden: boolean;
    currentUserId?: string;
  }
): Promise<FeedResponse> {
  const { cursor, limit, type, sort = 'chronological', showHidden, currentUserId } = options;

  // Build where clause
  const where: {
    league: { slug: string };
    isHidden?: boolean;
    type?: MomentType;
  } = {
    league: { slug: leagueSlug },
  };

  // Filter out hidden moments unless user is commissioner
  if (!showHidden) {
    where.isHidden = false;
  }

  // Filter by moment type if specified
  if (type) {
    where.type = type;
  }

  // Build orderBy based on sort option
  // Pinned moments always come first, then sort by specified criteria
  const orderBy =
    sort === 'recent'
      ? [{ isPinned: 'desc' as const }, { lastActivityAt: 'desc' as const }, { createdAt: 'desc' as const }]
      : [{ isPinned: 'desc' as const }, { createdAt: 'desc' as const }];

  // Fetch moments with author, reactions, and comment count
  const moments = await prisma.moment.findMany({
    where,
    orderBy,
    take: limit + 1, // Fetch one extra to determine if there are more
    ...(cursor && {
      skip: 1, // Skip the cursor item
      cursor: { id: cursor },
    }),
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      reactions: {
        select: {
          reactionType: true,
          userId: true,
        },
      },
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  // Determine if there are more moments
  const hasMore = moments.length > limit;
  const pageMoments = hasMore ? moments.slice(0, limit) : moments;

  // Map to Moment type contract
  const mappedMoments = pageMoments.map((m) => mapPrismaToMoment(m, currentUserId));

  return {
    moments: mappedMoments,
    nextCursor: hasMore ? pageMoments[pageMoments.length - 1]?.id : null,
  };
}

/**
 * Get feed data for a league
 *
 * Fetches moments ordered by createdAt DESC with pinned moments first.
 * Includes reaction counts, comment counts, and author information.
 * Filters out hidden moments unless user is a commissioner.
 *
 * @param input - Feed query parameters
 * @returns FeedResponse with moments and pagination cursor
 */
export async function getFeed(input: GetFeedInput): Promise<FeedResponse> {
  const { leagueSlug, cursor, sort = 'chronological', type, noCache = false } = input;
  const limit = input.limit ?? DEFAULT_LIMIT;

  // Get current user session
  const session = await auth();
  const currentUserId = session?.user?.id;

  // Determine if user can see hidden moments (commissioners only)
  let showHidden = false;
  if (currentUserId) {
    const userRole = await getUserRoleBySlug(currentUserId, leagueSlug);
    showHidden = hasRolePermission(userRole, 'commissioner');
  }

  // If noCache is requested, fetch directly without caching
  if (noCache) {
    return fetchFeedFromDb(leagueSlug, {
      cursor,
      limit,
      type,
      sort,
      showHidden,
      currentUserId,
    });
  }

  const cacheKey = [
    'feed',
    leagueSlug,
    cursor ?? 'start',
    String(limit),
    type ?? 'all',
    sort,
    showHidden ? 'hidden' : 'visible',
    currentUserId ?? 'anon',
  ];

  const getCachedFeed = unstable_cache(
    async () => {
      return fetchFeedFromDb(leagueSlug, {
        cursor,
        limit,
        type,
        sort,
        showHidden,
        currentUserId,
      });
    },
    cacheKey,
    {
      tags: [`feed-${leagueSlug}`],
      revalidate: 60, // Cache for 60 seconds
    }
  );

  return getCachedFeed();
}
