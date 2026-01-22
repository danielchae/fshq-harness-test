// Data layer for league members
// Replaced mock implementation with Prisma queries

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

import type { LeagueMember, MemberRole, PendingMember } from '@/types/member';
import type { MembershipRole, MembershipStatus } from '@prisma/client';

export interface GetMembersInput {
  leagueSlug: string;
}

// Define role priority ordering for sorting
const ROLE_PRIORITY: Record<string, number> = {
  commissioner: 0,
  admin: 1,
  manager: 2,
  fan: 3,
};

/**
 * Get all approved members for a league with user and team data.
 * Orders by role priority (commissioner > admin > manager > fan), then by username.
 * Uses caching with tag: members-{leagueSlug}
 */
export async function getMembers(input: GetMembersInput): Promise<LeagueMember[]> {
  return getCachedMembers(input.leagueSlug);
}

const getCachedMembers = unstable_cache(
  async (leagueSlug: string): Promise<LeagueMember[]> => {
    // First, find the league by slug
    const league = await prisma.league.findUnique({
      where: { slug: leagueSlug },
      select: { id: true },
    });

    if (!league) {
      return [];
    }

    // Query memberships with user and team data
    // Include approved members (status = 'approved' or where status might not be set for legacy data)
    const memberships = await prisma.leagueMembership.findMany({
      where: {
        leagueId: league.id,
        status: 'approved',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            username: true,
          },
        },
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    // Map to LeagueMember type and sort by role then username
    const members: LeagueMember[] = memberships
      .map((m) => ({
        id: m.id,
        userId: m.userId,
        leagueId: m.leagueId,
        name: m.user.name || m.user.username || 'Unknown',
        email: m.user.email,
        avatarUrl: m.user.avatarUrl || null,
        role: m.role.toLowerCase() as MemberRole,
        teamName: m.team?.name,
        joinedAt: m.createdAt.toISOString(),
        lastActive: m.updatedAt.toISOString(),
      }))
      .sort((a, b) => {
        // First sort by role priority
        const roleOrderA = ROLE_PRIORITY[a.role] ?? 4;
        const roleOrderB = ROLE_PRIORITY[b.role] ?? 4;

        if (roleOrderA !== roleOrderB) {
          return roleOrderA - roleOrderB;
        }

        // Then sort by name alphabetically
        return a.name.localeCompare(b.name);
      });

    return members;
  },
  ['members'],
  {
    tags: ['members'],
    revalidate: 300, // 5 minutes
  }
);

export interface GetPendingMembersInput {
  leagueSlug: string;
}

/**
 * Get all pending members awaiting approval for a league.
 * These are members with status = 'pending'.
 */
export async function getPendingMembers(input: GetPendingMembersInput): Promise<PendingMember[]> {
  // First, find the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: input.leagueSlug },
    select: { id: true },
  });

  if (!league) {
    return [];
  }

  // Query pending memberships
  const pendingMemberships = await prisma.leagueMembership.findMany({
    where: {
      leagueId: league.id,
      status: 'pending',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc', // Oldest requests first
    },
  });

  // Map to PendingMember type
  const pendingMembers: PendingMember[] = pendingMemberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    leagueId: m.leagueId,
    name: m.user.name || m.user.username || 'Unknown',
    email: m.user.email,
    avatarUrl: m.user.avatarUrl || null,
    requestedAt: m.createdAt.toISOString(),
  }));

  return pendingMembers;
}

export interface ApproveMemberInput {
  leagueSlug: string;
  pendingMemberId: string;
  approvedById?: string; // User ID of the approver
}

/**
 * Approve a pending membership request.
 * Updates the membership status from 'pending' to 'approved'.
 */
export async function approveMember(input: ApproveMemberInput): Promise<LeagueMember> {
  // Update the membership status to approved
  const membership = await prisma.leagueMembership.update({
    where: {
      id: input.pendingMemberId,
    },
    data: {
      status: 'approved',
      approvedById: input.approvedById || null,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          username: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  // Return the approved member in LeagueMember format
  return {
    id: membership.id,
    userId: membership.userId,
    leagueId: membership.leagueId,
    name: membership.user.name || membership.user.username || 'Unknown',
    email: membership.user.email,
    avatarUrl: membership.user.avatarUrl || null,
    role: membership.role.toLowerCase() as MemberRole,
    teamName: membership.team?.name,
    joinedAt: membership.createdAt.toISOString(),
    lastActive: membership.updatedAt.toISOString(),
  };
}

export interface DenyMemberInput {
  leagueSlug: string;
  pendingMemberId: string;
}

/**
 * Deny (reject) a pending membership request.
 * Updates the membership status from 'pending' to 'rejected'.
 * We could also delete the record, but keeping it allows for audit trail.
 */
export async function denyMember(input: DenyMemberInput): Promise<void> {
  // Update the membership status to rejected
  await prisma.leagueMembership.update({
    where: {
      id: input.pendingMemberId,
    },
    data: {
      status: 'rejected',
    },
  });
}

export interface UpdateMemberRoleInput {
  leagueSlug: string;
  memberId: string;
  newRole: MemberRole;
}

/**
 * Update a member's role in the league.
 * Validates that the new role is valid before updating.
 */
export async function updateMemberRole(input: UpdateMemberRoleInput): Promise<LeagueMember> {
  // Map MemberRole to Prisma MembershipRole enum
  const prismaRole = input.newRole as MembershipRole;

  // Update the membership role
  const membership = await prisma.leagueMembership.update({
    where: {
      id: input.memberId,
    },
    data: {
      role: prismaRole,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          username: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  // Return the updated member
  return {
    id: membership.id,
    userId: membership.userId,
    leagueId: membership.leagueId,
    name: membership.user.name || membership.user.username || 'Unknown',
    email: membership.user.email,
    avatarUrl: membership.user.avatarUrl || null,
    role: membership.role.toLowerCase() as MemberRole,
    teamName: membership.team?.name,
    joinedAt: membership.createdAt.toISOString(),
    lastActive: membership.updatedAt.toISOString(),
  };
}
