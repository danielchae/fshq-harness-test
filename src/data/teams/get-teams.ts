import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

// Team type definition (production version without mock dependencies)
export interface Team {
  id: string;
  leagueId: string;
  name: string;
  ownerUsername: string;
  sleeperUsername?: string;
  managerId: string;
  ownerId?: string;
  avatarUrl?: string;
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
  isClaimed: boolean;
  claimedBy?: string;
  claimed?: boolean; // Alias for isClaimed for backward compatibility
}

export interface GetTeamsInput {
  leagueSlug: string;
  includeClaimedBy?: boolean;
}

/**
 * Core implementation of getTeams - queries teams from the database
 * Returns empty array if league not found (production-ready behavior)
 */
async function getTeamsImpl(leagueSlug: string): Promise<Team[]> {
  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  // If no league found, return empty array (no mock fallback)
  if (!league) {
    return [];
  }

  // Query teams from database, ordered by wins DESC
  const dbTeams = await prisma.team.findMany({
    where: { leagueId: league.id },
    orderBy: { wins: 'desc' },
  });

  // Map Prisma model to frontend Team type contract
  const teams: Team[] = dbTeams.map((team) => ({
    id: team.id,
    leagueId: team.leagueId,
    name: team.name,
    ownerUsername: team.ownerUsername ?? '',
    sleeperUsername: team.sleeperUsername ?? team.ownerUsername ?? '',
    managerId: team.managerId ?? team.id, // Use team id as fallback
    ownerId: team.managerId ?? undefined,
    avatarUrl: team.avatarUrl ?? undefined,
    record: {
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
    },
    isClaimed: team.isClaimed,
    claimed: team.isClaimed, // Backward compatibility alias
    claimedBy: team.claimedBy ?? undefined,
  }));

  return teams;
}

/**
 * Get teams for a league with caching
 * Uses unstable_cache with tag: teams-{leagueSlug}
 */
export async function getTeams(input: GetTeamsInput): Promise<Team[]> {
  const { leagueSlug } = input;

  // Use unstable_cache for caching with a tag for invalidation
  // Reduced revalidate time to 60s for faster updates after claims
  const cachedGetTeams = unstable_cache(async () => getTeamsImpl(leagueSlug), [`teams-${leagueSlug}`], {
    tags: [`teams-${leagueSlug}`],
    revalidate: 60, // Cache for 1 minute (reduced from 5 minutes)
  });

  return cachedGetTeams();
}

/**
 * Get teams that are not yet claimed (available for team selection wizard)
 */
export async function getAvailableTeams(leagueSlug: string): Promise<Team[]> {
  const teams = await getTeams({ leagueSlug });
  return teams.filter((team) => !team.isClaimed);
}

/**
 * Get all teams for fan support (fans can support any team, claimed or not)
 */
export async function getAllTeamsForSupport(leagueSlug: string): Promise<Team[]> {
  return getTeams({ leagueSlug });
}
