/**
 * Feed Data Fetcher
 *
 * Fetches league moments with reactions and comments using Prisma.
 * Implements RLS by checking user's role in league.
 * Uses keyset pagination for stable results across sort modes.
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
 * Cursor structure for keyset pagination
 * Encodes all sort field values for stable pagination
 */
interface FeedCursor {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  isPinned: boolean;
}

/**
 * Encode cursor object to base64 string
 */
function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

/**
 * Decode base64 cursor string to cursor object
 * Falls back to legacy id-only cursor for backwards compatibility
 */
function decodeCursor(cursorString: string): FeedCursor | null {
  try {
    // Try to decode as new keyset cursor
    const decoded = Buffer.from(cursorString, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed.id && parsed.createdAt && parsed.lastActivityAt !== undefined) {
      return parsed as FeedCursor;
    }
  } catch {
    // Not a valid base64 JSON cursor
  }

  // Legacy fallback: treat as raw ID (for backwards compatibility during rollout)
  // This handles old cursors that were just moment IDs
  if (cursorString && !cursorString.includes('{')) {
    return null; // Signal to use legacy cursor handling
  }

  return null;
}

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
  lastActivityAt: Date | null;
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
 * Uses keyset pagination for stable results regardless of sort mode
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

  // Decode cursor if provided
  const decodedCursor = cursor ? decodeCursor(cursor) : null;

  // Build base where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
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
      ? [{ isPinned: 'desc' as const }, { lastActivityAt: 'desc' as const }, { createdAt: 'desc' as const }, { id: 'desc' as const }]
      : [{ isPinned: 'desc' as const }, { createdAt: 'desc' as const }, { id: 'desc' as const }];

  // Apply keyset pagination if we have a decoded cursor
  // This ensures stable pagination even when data changes between requests
  if (decodedCursor) {
    const cursorDate = new Date(decodedCursor.createdAt);
    const cursorActivityDate = new Date(decodedCursor.lastActivityAt);

    if (sort === 'recent') {
      // Keyset condition for recent sort: (isPinned, lastActivityAt, createdAt, id) < cursor values
      where.OR = [
        // Lower priority pinned status
        { isPinned: false, ...(decodedCursor.isPinned ? {} : { AND: [{ id: { not: decodedCursor.id } }] }) },
        // Same pinned status, earlier lastActivityAt
        ...(decodedCursor.isPinned
          ? []
          : [
              {
                isPinned: decodedCursor.isPinned,
                lastActivityAt: { lt: cursorActivityDate },
              },
              // Same pinned and lastActivityAt, earlier createdAt
              {
                isPinned: decodedCursor.isPinned,
                lastActivityAt: cursorActivityDate,
                createdAt: { lt: cursorDate },
              },
              // Same pinned, lastActivityAt, and createdAt, lower id
              {
                isPinned: decodedCursor.isPinned,
                lastActivityAt: cursorActivityDate,
                createdAt: cursorDate,
                id: { lt: decodedCursor.id },
              },
            ]),
      ];

      // Simplify: if cursor was pinned, we want unpinned items OR pinned items after cursor
      if (decodedCursor.isPinned) {
        where.OR = [
          { isPinned: false },
          {
            isPinned: true,
            lastActivityAt: { lt: cursorActivityDate },
          },
          {
            isPinned: true,
            lastActivityAt: cursorActivityDate,
            createdAt: { lt: cursorDate },
          },
          {
            isPinned: true,
            lastActivityAt: cursorActivityDate,
            createdAt: cursorDate,
            id: { lt: decodedCursor.id },
          },
        ];
      }
    } else {
      // Keyset condition for chronological sort: (isPinned, createdAt, id) < cursor values
      if (decodedCursor.isPinned) {
        where.OR = [
          { isPinned: false },
          {
            isPinned: true,
            createdAt: { lt: cursorDate },
          },
          {
            isPinned: true,
            createdAt: cursorDate,
            id: { lt: decodedCursor.id },
          },
        ];
      } else {
        where.AND = [
          { isPinned: false },
          {
            OR: [{ createdAt: { lt: cursorDate } }, { createdAt: cursorDate, id: { lt: decodedCursor.id } }],
          },
        ];
      }
    }
  } else if (cursor) {
    // Legacy fallback: use simple cursor pagination for old-format cursors
    // This maintains backwards compatibility during rollout
    where.id = { lt: cursor };
  }

  // Fetch moments with author, reactions, and comment count
  const moments = await prisma.moment.findMany({
    where,
    orderBy,
    take: limit + 1, // Fetch one extra to determine if there are more
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

  // Build next cursor using keyset pagination
  let nextCursor: string | null = null;
  if (hasMore && pageMoments.length > 0) {
    const lastMoment = pageMoments[pageMoments.length - 1];
    // We need the raw Prisma moment for the cursor, not the mapped one
    const lastPrismaMoment = moments[pageMoments.length - 1];
    if (lastMoment && lastPrismaMoment) {
      nextCursor = encodeCursor({
        id: lastMoment.id,
        createdAt: lastPrismaMoment.createdAt.toISOString(),
        lastActivityAt: lastPrismaMoment.lastActivityAt?.toISOString() ?? lastPrismaMoment.createdAt.toISOString(),
        isPinned: lastPrismaMoment.isPinned,
      });
    }
  }

  return {
    moments: mappedMoments,
    nextCursor,
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
      // Short TTL as safety net in case revalidateTag() doesn't propagate
      // Primary invalidation is via revalidateTag() on moderation actions
      revalidate: 10,
    }
  );

  return getCachedFeed();
}
