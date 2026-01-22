import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

import type { UserLeague } from '@/types/user-league';

/**
 * Get all leagues for a user
 * Queries leagues where the user has an approved membership
 * Orders by most recently active (league updatedAt)
 *
 * @param userId - The authenticated user's ID
 * @returns UserLeague[] - Array of leagues with navigation data
 */
export async function getUserLeagues(userId?: string): Promise<UserLeague[]> {
  // If no userId provided, return empty array (unauthenticated)
  if (!userId) {
    return [];
  }

  return getUserLeaguesCached(userId);
}

/**
 * Cached internal implementation
 * Uses unstable_cache with tag: user-leagues-{userId}
 */
const getUserLeaguesCached = unstable_cache(
  async (userId: string): Promise<UserLeague[]> => {
    // Query all memberships for this user with approved status
    const memberships = await prisma.leagueMembership.findMany({
      where: {
        userId,
        status: 'approved',
      },
      include: {
        league: {
          select: {
            id: true,
            slug: true,
            name: true,
            avatarUrl: true,
            updatedAt: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        league: {
          updatedAt: 'desc',
        },
      },
    });

    // Map to UserLeague type
    return memberships.map((membership) => ({
      id: membership.league.id,
      slug: membership.league.slug,
      name: membership.league.name,
      logoUrl: membership.league.avatarUrl ?? undefined,
      role: membership.role,
      teamId: membership.team?.id ?? null,
      teamName: membership.team?.name ?? null,
    }));
  },
  ['user-leagues'],
  {
    tags: ['user-leagues'],
    revalidate: 60, // Cache for 1 minute
  }
);

/**
 * Revalidation helper - call this when user membership changes
 */
export function getUserLeaguesCacheTag(userId: string): string {
  return `user-leagues-${userId}`;
}
