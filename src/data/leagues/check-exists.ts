// Data layer for checking if a league already exists in FSHQ
// Queries by external platform league ID to prevent duplicates during sync

import { Platform } from '@prisma/client';
import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

export interface CheckLeagueExistsInput {
  sleeperLeagueId: string;
  platform?: Platform;
}

export interface CheckLeagueExistsResult {
  exists: boolean;
  leagueSlug?: string;
  leagueId?: string;
  leagueName?: string;
}

/**
 * Internal function to check if a league exists by platform league ID.
 * Queries the database for a league with the given external platform ID.
 */
async function checkLeagueExistsInternal(
  platformLeagueId: string,
  platform: Platform = 'sleeper'
): Promise<CheckLeagueExistsResult> {
  const league = await prisma.league.findFirst({
    where: {
      platformLeagueId,
      platform,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (league) {
    return {
      exists: true,
      leagueSlug: league.slug,
      leagueId: league.id,
      leagueName: league.name,
    };
  }

  return { exists: false };
}

/**
 * Creates a cached version of the league existence check.
 * Cache is tagged with the platform league ID for targeted invalidation.
 */
function createCachedCheckLeagueExists(platformLeagueId: string, platform: Platform) {
  return unstable_cache(
    () => checkLeagueExistsInternal(platformLeagueId, platform),
    [`league-exists-${platform}-${platformLeagueId}`],
    {
      tags: [`league-exists-${platformLeagueId}`],
      revalidate: 60, // Cache for 60 seconds - short TTL for sync flow accuracy
    }
  );
}

/**
 * Check if a Sleeper league has already been connected to FSHQ.
 * Used during sync flow to prevent duplicates.
 *
 * @param input - The input containing the Sleeper league ID
 * @returns CheckLeagueExistsResult with exists boolean and league slug if found
 */
export async function checkLeagueExists(input: CheckLeagueExistsInput): Promise<CheckLeagueExistsResult> {
  const { sleeperLeagueId, platform = 'sleeper' } = input;

  // Use cached query for performance
  const getCachedResult = createCachedCheckLeagueExists(sleeperLeagueId, platform);
  return getCachedResult();
}
