// Data layer for joining an existing league
// Handles both auto-join and approval-required leagues

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';
import { notifyMembershipApproved } from '@/lib/notifications';

import type { JoinRule, MembershipStatus } from '@prisma/client';

export interface JoinLeagueInput {
  leagueSlug: string;
  userId: string;
}

export interface JoinLeagueResult {
  success: boolean;
  status?: 'joined' | 'pending' | 'already_member' | 'already_pending';
  membershipId?: string;
  message: string;
  leagueSlug?: string;
  leagueName?: string;
}

/**
 * Join an existing league.
 *
 * Behavior based on league's joinRule:
 * - auto_join: Creates approved membership immediately, user can access league
 * - approval_required: Creates pending membership, commissioner must approve
 *
 * Returns existing membership status if user already has one.
 */
export async function joinLeague(input: JoinLeagueInput): Promise<JoinLeagueResult> {
  const { leagueSlug, userId } = input;

  try {
    // 1. Find the league by slug
    const league = await prisma.league.findUnique({
      where: { slug: leagueSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        joinRule: true,
        visibility: true,
      },
    });

    if (!league) {
      return {
        success: false,
        message: 'League not found',
      };
    }

    // 2. Check for existing membership
    const existingMembership = await prisma.leagueMembership.findUnique({
      where: {
        user_league_unique: {
          userId,
          leagueId: league.id,
        },
      },
      select: {
        id: true,
        status: true,
        role: true,
      },
    });

    if (existingMembership) {
      // User already has a membership
      if (existingMembership.status === 'approved') {
        return {
          success: true,
          status: 'already_member',
          membershipId: existingMembership.id,
          message: `You're already a member of ${league.name}`,
          leagueSlug: league.slug,
          leagueName: league.name,
        };
      }

      if (existingMembership.status === 'pending') {
        return {
          success: true,
          status: 'already_pending',
          membershipId: existingMembership.id,
          message: `Your request to join ${league.name} is pending approval`,
          leagueSlug: league.slug,
          leagueName: league.name,
        };
      }

      // If rejected, allow them to request again by updating status to pending
      if (existingMembership.status === 'rejected') {
        const updatedMembership = await prisma.leagueMembership.update({
          where: { id: existingMembership.id },
          data: {
            status: league.joinRule === 'auto_join' ? 'approved' : 'pending',
            updatedAt: new Date(),
          },
        });

        const isAutoJoin = league.joinRule === 'auto_join';

        if (isAutoJoin) {
          // Revalidate user leagues cache
          revalidatePath(`/leagues/${league.slug}`);

          return {
            success: true,
            status: 'joined',
            membershipId: updatedMembership.id,
            message: `Welcome to ${league.name}!`,
            leagueSlug: league.slug,
            leagueName: league.name,
          };
        }

        return {
          success: true,
          status: 'pending',
          membershipId: updatedMembership.id,
          message: `Your request to join ${league.name} has been submitted`,
          leagueSlug: league.slug,
          leagueName: league.name,
        };
      }
    }

    // 3. Determine membership status based on joinRule
    const membershipStatus: MembershipStatus =
      league.joinRule === 'auto_join' ? 'approved' : 'pending';

    // 4. Create new membership
    const membership = await prisma.leagueMembership.create({
      data: {
        userId,
        leagueId: league.id,
        role: 'fan', // New members start as fans, can claim team later
        status: membershipStatus,
      },
    });

    // 5. Handle post-join actions based on status
    if (membershipStatus === 'approved') {
      // Auto-join: User is now a member
      revalidatePath(`/leagues/${league.slug}`);

      // Send welcome notification
      try {
        await notifyMembershipApproved(userId, league.slug);
      } catch (error) {
        // Don't fail the join if notification fails
        console.error('Failed to send join notification:', error);
      }

      return {
        success: true,
        status: 'joined',
        membershipId: membership.id,
        message: `Welcome to ${league.name}!`,
        leagueSlug: league.slug,
        leagueName: league.name,
      };
    }

    // Approval required: Request is pending
    // TODO: Notify commissioner of pending request

    return {
      success: true,
      status: 'pending',
      membershipId: membership.id,
      message: `Your request to join ${league.name} has been submitted. The commissioner will review your request.`,
      leagueSlug: league.slug,
      leagueName: league.name,
    };
  } catch (error) {
    console.error('Error joining league:', error);

    // Handle unique constraint violation (race condition)
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      return {
        success: false,
        message: 'You already have a membership in this league',
      };
    }

    return {
      success: false,
      message: 'Failed to join league. Please try again.',
    };
  }
}

/**
 * Get a user's membership status for a league.
 * Useful for checking before allowing join actions.
 */
export async function getMembershipStatus(
  userId: string,
  leagueSlug: string
): Promise<{
  exists: boolean;
  status?: MembershipStatus;
  role?: string;
}> {
  const membership = await prisma.leagueMembership.findFirst({
    where: {
      userId,
      league: { slug: leagueSlug },
    },
    select: {
      status: true,
      role: true,
    },
  });

  if (!membership) {
    return { exists: false };
  }

  return {
    exists: true,
    status: membership.status,
    role: membership.role,
  };
}
