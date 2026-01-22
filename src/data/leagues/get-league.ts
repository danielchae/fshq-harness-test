import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

import type { JoinRule, Visibility } from '@prisma/client';

// League type definition (production version without mock dependencies)
export interface League {
  id: string;
  slug: string;
  name: string;
  description: string;
  teamCount: number;
  season: number;
  platform: 'sleeper' | 'espn' | 'yahoo';
  avatarUrl?: string;
  createdAt: string;
  visibility: 'public' | 'private';
  joinRule: 'auto-join' | 'approval';
}

export interface GetLeagueInput {
  slug: string;
}

/**
 * Maps Prisma visibility enum to frontend type
 */
function mapVisibility(visibility: Visibility): 'public' | 'private' {
  return visibility === 'public' ? 'public' : 'private';
}

/**
 * Maps Prisma join rule enum to frontend type
 */
function mapJoinRule(joinRule: JoinRule): 'auto-join' | 'approval' {
  return joinRule === 'auto_join' ? 'auto-join' : 'approval';
}

/**
 * Fetches a league by slug from the database.
 * This is the uncached version of the query.
 */
async function fetchLeagueBySlug(slug: string): Promise<League | null> {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      settings: true,
      _count: {
        select: {
          memberships: {
            where: { status: 'approved' },
          },
        },
      },
    },
  });

  if (!league) {
    return null;
  }

  // Map Prisma League to frontend League type
  return {
    id: league.id,
    slug: league.slug,
    name: league.name,
    description: league.description ?? '',
    teamCount: league.teamCount,
    season: league.season,
    platform: league.platform as 'sleeper' | 'espn' | 'yahoo',
    avatarUrl: league.avatarUrl ?? undefined,
    createdAt: league.createdAt.toISOString(),
    visibility: mapVisibility(league.visibility),
    joinRule: mapJoinRule(league.joinRule),
  };
}

/**
 * Get league by slug with caching.
 * Uses Next.js unstable_cache for data caching with tag-based revalidation.
 *
 * @param input - Input containing the league slug
 * @returns The league data or null if not found
 */
export async function getLeague(input: GetLeagueInput): Promise<League | null> {
  const { slug } = input;

  // Use unstable_cache for caching with tag-based revalidation
  const getCachedLeague = unstable_cache(
    async () => fetchLeagueBySlug(slug),
    [`league-${slug}`],
    {
      tags: [`league-${slug}`],
      revalidate: 300, // Revalidate every 5 minutes
    }
  );

  return getCachedLeague();
}

/**
 * Get league by ID.
 *
 * @param id - The league ID
 * @returns The league data or null if not found
 */
export async function getLeagueById(id: string): Promise<League | null> {
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      settings: true,
      _count: {
        select: {
          memberships: {
            where: { status: 'approved' },
          },
        },
      },
    },
  });

  if (!league) {
    return null;
  }

  // Map Prisma League to frontend League type
  return {
    id: league.id,
    slug: league.slug,
    name: league.name,
    description: league.description ?? '',
    teamCount: league.teamCount,
    season: league.season,
    platform: league.platform as 'sleeper' | 'espn' | 'yahoo',
    avatarUrl: league.avatarUrl ?? undefined,
    createdAt: league.createdAt.toISOString(),
    visibility: mapVisibility(league.visibility),
    joinRule: mapJoinRule(league.joinRule),
  };
}
