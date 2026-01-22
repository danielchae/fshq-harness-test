/**
 * Public Access Utilities
 *
 * Provides helpers for checking and managing public league access
 * for unauthenticated visitors.
 *
 * @module src/lib/auth/public-access
 */

import { prisma } from '@/lib/db';

/**
 * Check if a league is publicly visible by slug.
 *
 * @param slug - The league slug
 * @returns Object with isPublic flag and league info if found
 */
export async function checkLeaguePublicAccess(slug: string): Promise<{
  exists: boolean;
  isPublic: boolean;
  leagueId: string | null;
}> {
  const league = await prisma.league.findUnique({
    where: { slug },
    select: {
      id: true,
      visibility: true,
    },
  });

  if (!league) {
    return {
      exists: false,
      isPublic: false,
      leagueId: null,
    };
  }

  return {
    exists: true,
    isPublic: league.visibility === 'public',
    leagueId: league.id,
  };
}

/**
 * Check if a league is publicly visible by ID.
 *
 * @param leagueId - The league ID
 * @returns true if the league exists and is public
 */
export async function isLeaguePublicById(leagueId: string): Promise<boolean> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      visibility: true,
    },
  });

  return league?.visibility === 'public';
}

/**
 * Get public content settings for a league.
 * These control what non-members can see on public leagues.
 *
 * @param slug - The league slug
 * @returns Public content visibility settings
 */
export async function getPublicContentSettings(slug: string): Promise<{
  rankings: boolean;
  matchups: boolean;
  brackets: boolean;
  transactions: boolean;
  history: boolean;
} | null> {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      settings: {
        select: {
          publicContent: true,
        },
      },
    },
  });

  if (!league?.settings) {
    return null;
  }

  const defaults = {
    rankings: true,
    matchups: true,
    brackets: true,
    transactions: false,
    history: true,
  };

  const publicContent = league.settings.publicContent as Record<string, unknown> | null;

  if (!publicContent || typeof publicContent !== 'object') {
    return defaults;
  }

  return {
    rankings: typeof publicContent.rankings === 'boolean' ? publicContent.rankings : defaults.rankings,
    matchups: typeof publicContent.matchups === 'boolean' ? publicContent.matchups : defaults.matchups,
    brackets: typeof publicContent.brackets === 'boolean' ? publicContent.brackets : defaults.brackets,
    transactions: typeof publicContent.transactions === 'boolean' ? publicContent.transactions : defaults.transactions,
    history: typeof publicContent.history === 'boolean' ? publicContent.history : defaults.history,
  };
}

/**
 * Type for the public access context passed to components
 */
export interface PublicAccessContext {
  isPublicVisitor: boolean;
  isAuthenticated: boolean;
  canInteract: boolean;
  leagueVisibility: 'public' | 'private';
}

/**
 * Determine the access context for a user viewing a league.
 *
 * @param userId - The user ID (null if not authenticated)
 * @param leagueSlug - The league slug
 * @param isMember - Whether the user is a member of the league
 * @returns Access context for the user
 */
export function getAccessContext(
  userId: string | null,
  leagueVisibility: 'public' | 'private',
  isMember: boolean
): PublicAccessContext {
  const isAuthenticated = !!userId;
  const isPublicVisitor = leagueVisibility === 'public' && !isMember;

  return {
    isPublicVisitor,
    isAuthenticated,
    canInteract: isAuthenticated && isMember,
    leagueVisibility,
  };
}
