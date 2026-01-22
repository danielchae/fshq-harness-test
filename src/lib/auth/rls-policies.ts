/**
 * Row-Level Security (RLS) Policy Utilities
 *
 * Implements application-level RLS for league access control.
 * Enforces that:
 * - Users can only view leagues they are members of
 * - Only commissioners can modify league settings
 * - Role-based access is enforced at the data layer
 *
 * @module src/lib/auth/rls-policies
 */

import { prisma } from '@/lib/db';

import type { UserRole } from '@/types/user';
import type { MembershipRole, MembershipStatus } from '@prisma/client';

/**
 * Error class for RLS policy violations
 */
export class RLSError extends Error {
  public readonly code: 'NOT_A_MEMBER' | 'INSUFFICIENT_ROLE' | 'LEAGUE_NOT_FOUND' | 'USER_NOT_AUTHENTICATED';
  public readonly statusCode: number;

  constructor(
    message: string,
    code: 'NOT_A_MEMBER' | 'INSUFFICIENT_ROLE' | 'LEAGUE_NOT_FOUND' | 'USER_NOT_AUTHENTICATED',
    statusCode = 403
  ) {
    super(message);
    this.name = 'RLSError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Role hierarchy levels for permission comparison.
 * Higher numbers indicate more permissions.
 */
const ROLE_HIERARCHY: Record<MembershipRole | UserRole, number> = {
  commissioner: 4,
  admin: 3,
  manager: 2,
  fan: 1,
};

/**
 * Result type for membership checks
 */
export interface MembershipCheckResult {
  isMember: boolean;
  role: MembershipRole | null;
  status: MembershipStatus | null;
  teamId: string | null;
}

/**
 * Check if a user is a member of a league
 *
 * @param userId - The user ID to check
 * @param leagueId - The league ID to check membership for
 * @returns Membership check result with role information
 */
export async function checkLeagueMembership(userId: string, leagueId: string): Promise<MembershipCheckResult> {
  const membership = await prisma.leagueMembership.findUnique({
    where: {
      user_league_unique: {
        userId,
        leagueId,
      },
    },
    select: {
      role: true,
      status: true,
      teamId: true,
    },
  });

  if (!membership) {
    return {
      isMember: false,
      role: null,
      status: null,
      teamId: null,
    };
  }

  // Only approved memberships count as "active" members
  const isMember = membership.status === 'approved';

  return {
    isMember,
    role: membership.role,
    status: membership.status,
    teamId: membership.teamId,
  };
}

/**
 * Get user's role in a specific league from the database
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @returns The user's role or null if not a member
 */
export async function getUserRoleInLeague(userId: string, leagueId: string): Promise<MembershipRole | null> {
  const membership = await prisma.leagueMembership.findFirst({
    where: {
      userId,
      leagueId,
      status: 'approved', // Only approved memberships have roles
    },
    select: {
      role: true,
    },
  });

  return membership?.role ?? null;
}

/**
 * Get user's role in a league by slug
 *
 * @param userId - The user ID
 * @param leagueSlug - The league slug
 * @returns The user's role or null if not a member
 */
export async function getUserRoleBySlug(userId: string, leagueSlug: string): Promise<MembershipRole | null> {
  const membership = await prisma.leagueMembership.findFirst({
    where: {
      userId,
      status: 'approved',
      league: {
        slug: leagueSlug,
      },
    },
    select: {
      role: true,
    },
  });

  return membership?.role ?? null;
}

/**
 * Check if a role meets or exceeds the required permission level
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if userRole meets or exceeds requiredRole
 */
export function hasRolePermission(
  userRole: MembershipRole | UserRole | null,
  requiredRole: MembershipRole | UserRole
): boolean {
  if (!userRole) return false;

  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userLevel >= requiredLevel;
}

/**
 * Check if user has access to a league (is an approved member)
 * This is the primary RLS check for league data visibility
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @returns true if user can access the league
 */
export async function canAccessLeague(userId: string, leagueId: string): Promise<boolean> {
  const { isMember } = await checkLeagueMembership(userId, leagueId);
  return isMember;
}

/**
 * Check if user can modify league settings
 * Only commissioners and admins can modify settings
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @returns true if user can modify league settings
 */
export async function canModifyLeagueSettings(userId: string, leagueId: string): Promise<boolean> {
  const role = await getUserRoleInLeague(userId, leagueId);
  return hasRolePermission(role, 'commissioner');
}

/**
 * Check if user can moderate content in a league
 * Commissioners and admins can moderate
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @returns true if user can moderate content
 */
export async function canModerateLeague(userId: string, leagueId: string): Promise<boolean> {
  const role = await getUserRoleInLeague(userId, leagueId);
  return hasRolePermission(role, 'admin');
}

/**
 * Check if user can post content in a league
 * All approved members can post
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @returns true if user can post content
 */
export async function canPostInLeague(userId: string, leagueId: string): Promise<boolean> {
  return canAccessLeague(userId, leagueId);
}

/**
 * Require league access - throws RLSError if not a member
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @throws RLSError if user is not an approved member
 */
export async function requireLeagueAccess(userId: string, leagueId: string): Promise<MembershipCheckResult> {
  const result = await checkLeagueMembership(userId, leagueId);

  if (!result.isMember) {
    if (result.status === 'pending') {
      throw new RLSError('Membership is pending approval', 'NOT_A_MEMBER', 403);
    }
    if (result.status === 'rejected') {
      throw new RLSError('Membership has been rejected', 'NOT_A_MEMBER', 403);
    }
    throw new RLSError('You are not a member of this league', 'NOT_A_MEMBER', 403);
  }

  return result;
}

/**
 * Require specific role - throws RLSError if insufficient permissions
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @param requiredRole - The minimum required role
 * @throws RLSError if user doesn't have required role
 */
export async function requireLeagueRole(
  userId: string,
  leagueId: string,
  requiredRole: MembershipRole | UserRole
): Promise<MembershipCheckResult> {
  const result = await requireLeagueAccess(userId, leagueId);

  if (!result.role || !hasRolePermission(result.role, requiredRole)) {
    throw new RLSError(`Requires ${requiredRole} role or higher`, 'INSUFFICIENT_ROLE', 403);
  }

  return result;
}

/**
 * Require commissioner role for league settings modification
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @throws RLSError if user is not a commissioner
 */
export async function requireCommissioner(userId: string, leagueId: string): Promise<MembershipCheckResult> {
  return requireLeagueRole(userId, leagueId, 'commissioner');
}

/**
 * Get all leagues a user is a member of
 * This enforces RLS by only returning leagues the user has access to
 *
 * @param userId - The user ID
 * @returns Array of league IDs the user is a member of
 */
export async function getUserLeagueIds(userId: string): Promise<string[]> {
  const memberships = await prisma.leagueMembership.findMany({
    where: {
      userId,
      status: 'approved',
    },
    select: {
      leagueId: true,
    },
  });

  return memberships.map((m) => m.leagueId);
}

/**
 * Get all leagues a user is a member of with details
 *
 * @param userId - The user ID
 * @returns Array of leagues with membership details
 */
export async function getUserLeagues(userId: string) {
  return prisma.leagueMembership.findMany({
    where: {
      userId,
      status: 'approved',
    },
    include: {
      league: true,
    },
  });
}

/**
 * RLS-aware query builder for leagues
 * Returns a Prisma where clause that filters to only accessible leagues
 *
 * @param userId - The user ID
 * @returns Prisma where clause for league access filtering
 */
export async function getLeagueAccessFilter(userId: string) {
  const leagueIds = await getUserLeagueIds(userId);

  return {
    id: {
      in: leagueIds,
    },
  };
}

/**
 * Validate that a league exists and user has access
 *
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @returns The league if accessible
 * @throws RLSError if league doesn't exist or user has no access
 */
export async function getAccessibleLeague(userId: string, leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  });

  if (!league) {
    throw new RLSError('League not found', 'LEAGUE_NOT_FOUND', 404);
  }

  await requireLeagueAccess(userId, leagueId);

  return league;
}

/**
 * Validate that a league exists by slug and user has access
 *
 * @param userId - The user ID
 * @param slug - The league slug
 * @returns The league if accessible
 * @throws RLSError if league doesn't exist or user has no access
 */
export async function getAccessibleLeagueBySlug(userId: string, slug: string) {
  const league = await prisma.league.findUnique({
    where: { slug },
  });

  if (!league) {
    throw new RLSError('League not found', 'LEAGUE_NOT_FOUND', 404);
  }

  await requireLeagueAccess(userId, league.id);

  return league;
}
