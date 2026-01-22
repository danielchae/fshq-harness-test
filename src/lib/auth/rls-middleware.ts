/**
 * RLS Middleware for API Routes
 *
 * Provides wrapper functions for API routes that enforce
 * Row-Level Security at the request handling level.
 *
 * @module src/lib/auth/rls-middleware
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkLeagueMembership,
  getUserRoleInLeague,
  requireLeagueAccess,
  requireLeagueRole,
  RLSError,
} from './rls-policies';

import type { MembershipRole } from '@prisma/client';

/**
 * Context provided to API handlers after RLS validation
 */
export interface RLSContext {
  userId: string;
  leagueId: string;
  role: MembershipRole;
  teamId: string | null;
}

/**
 * Resolve league ID from slug if needed
 */
async function resolveLeagueId(
  leagueIdOrSlug: string,
  prisma: Parameters<typeof import('@/lib/db').prisma.league.findUnique>[0] extends { where: infer W }
    ? { league: { findUnique: (args: { where: W }) => Promise<{ id: string } | null> } }
    : never
): Promise<string | null> {
  // If it looks like a cuid, use it directly
  if (leagueIdOrSlug.length > 20 && !leagueIdOrSlug.includes('-')) {
    return leagueIdOrSlug;
  }

  // Otherwise, treat it as a slug
  const { prisma: db } = await import('@/lib/db');
  const league = await db.league.findUnique({
    where: { slug: leagueIdOrSlug },
    select: { id: true },
  });

  return league?.id ?? null;
}

/**
 * Higher-order function to wrap API handlers with RLS authentication
 *
 * @param handler - The API handler function
 * @returns Wrapped handler that enforces authentication
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (request, { userId }) => {
 *   // userId is guaranteed to be defined here
 *   return NextResponse.json({ userId });
 * });
 * ```
 */
export function withAuth<T>(handler: (request: Request, context: { userId: string }) => Promise<NextResponse<T>>) {
  return async (request: Request): Promise<NextResponse<T | { error: string }>> => {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return handler(request, { userId: session.user.id });
  };
}

/**
 * Higher-order function to wrap API handlers with league membership check
 *
 * @param getLeagueId - Function to extract league ID from request/params
 * @param handler - The API handler function
 * @returns Wrapped handler that enforces league membership
 *
 * @example
 * ```typescript
 * export const GET = withLeagueAccess(
 *   (req, params) => params.leagueId,
 *   async (request, context) => {
 *     // context.userId and context.leagueId are validated
 *     return NextResponse.json({ role: context.role });
 *   }
 * );
 * ```
 */
export function withLeagueAccess<TParams>(
  getLeagueId: (request: Request, params: TParams) => string | Promise<string>,
  handler: (request: Request, context: RLSContext, params: TParams) => Promise<NextResponse>
) {
  return async (request: Request, { params }: { params: TParams }): Promise<NextResponse> => {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
      const leagueIdOrSlug = await getLeagueId(request, params);
      const { prisma } = await import('@/lib/db');

      // Resolve slug to ID if needed
      let leagueId = leagueIdOrSlug;
      if (leagueIdOrSlug.length <= 20 || leagueIdOrSlug.includes('-')) {
        const league = await prisma.league.findUnique({
          where: { slug: leagueIdOrSlug },
          select: { id: true },
        });
        if (!league) {
          return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }
        leagueId = league.id;
      }

      const membership = await requireLeagueAccess(session.user.id, leagueId);

      return handler(
        request,
        {
          userId: session.user.id,
          leagueId,
          role: membership.role!,
          teamId: membership.teamId,
        },
        params
      );
    } catch (error) {
      if (error instanceof RLSError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  };
}

/**
 * Higher-order function to wrap API handlers with commissioner role requirement
 *
 * @param getLeagueId - Function to extract league ID from request/params
 * @param handler - The API handler function
 * @returns Wrapped handler that enforces commissioner role
 */
export function withCommissionerAccess<TParams>(
  getLeagueId: (request: Request, params: TParams) => string | Promise<string>,
  handler: (request: Request, context: RLSContext, params: TParams) => Promise<NextResponse>
) {
  return async (request: Request, { params }: { params: TParams }): Promise<NextResponse> => {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
      const leagueIdOrSlug = await getLeagueId(request, params);
      const { prisma } = await import('@/lib/db');

      // Resolve slug to ID if needed
      let leagueId = leagueIdOrSlug;
      if (leagueIdOrSlug.length <= 20 || leagueIdOrSlug.includes('-')) {
        const league = await prisma.league.findUnique({
          where: { slug: leagueIdOrSlug },
          select: { id: true },
        });
        if (!league) {
          return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }
        leagueId = league.id;
      }

      const membership = await requireLeagueRole(session.user.id, leagueId, 'commissioner');

      return handler(
        request,
        {
          userId: session.user.id,
          leagueId,
          role: membership.role!,
          teamId: membership.teamId,
        },
        params
      );
    } catch (error) {
      if (error instanceof RLSError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  };
}

/**
 * Higher-order function to wrap API handlers with custom role requirement
 *
 * @param requiredRole - The minimum required role
 * @param getLeagueId - Function to extract league ID from request/params
 * @param handler - The API handler function
 * @returns Wrapped handler that enforces role requirement
 */
export function withLeagueRole<TParams>(
  requiredRole: MembershipRole,
  getLeagueId: (request: Request, params: TParams) => string | Promise<string>,
  handler: (request: Request, context: RLSContext, params: TParams) => Promise<NextResponse>
) {
  return async (request: Request, { params }: { params: TParams }): Promise<NextResponse> => {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
      const leagueIdOrSlug = await getLeagueId(request, params);
      const { prisma } = await import('@/lib/db');

      // Resolve slug to ID if needed
      let leagueId = leagueIdOrSlug;
      if (leagueIdOrSlug.length <= 20 || leagueIdOrSlug.includes('-')) {
        const league = await prisma.league.findUnique({
          where: { slug: leagueIdOrSlug },
          select: { id: true },
        });
        if (!league) {
          return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }
        leagueId = league.id;
      }

      const membership = await requireLeagueRole(session.user.id, leagueId, requiredRole);

      return handler(
        request,
        {
          userId: session.user.id,
          leagueId,
          role: membership.role!,
          teamId: membership.teamId,
        },
        params
      );
    } catch (error) {
      if (error instanceof RLSError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  };
}

/**
 * Utility to check league access without throwing
 * Useful for conditional rendering in server components
 */
export async function checkLeagueAccess(leagueId: string): Promise<RLSContext | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const membership = await checkLeagueMembership(session.user.id, leagueId);

  if (!membership.isMember || !membership.role) {
    return null;
  }

  return {
    userId: session.user.id,
    leagueId,
    role: membership.role,
    teamId: membership.teamId,
  };
}
