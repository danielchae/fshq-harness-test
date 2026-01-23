import { revalidateTag } from 'next/cache';

import { prisma } from '@/lib/db';

import type { Team } from './get-teams';

export interface ClaimTeamInput {
  teamId: string;
  userId: string;
  leagueSlug: string;
}

export interface ClaimTeamResult {
  success: boolean;
  team?: Team;
  message?: string;
}

/**
 * Claims a team for a user, creating or updating their membership to manager role.
 *
 * This function:
 * 1. Validates the team exists
 * 2. Validates the team is not already claimed
 * 3. Creates or updates membership record with manager role
 * 4. Links teamId to membership
 * 5. Marks team as claimed
 */
export async function claimTeam(input: ClaimTeamInput): Promise<ClaimTeamResult> {
  const { teamId, userId, leagueSlug } = input;

  // Find the team with its league
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      league: true,
    },
  });

  if (!team) {
    return { success: false, message: 'Team not found' };
  }

  // Validate team belongs to the specified league
  if (team.league.slug !== leagueSlug) {
    return { success: false, message: 'Team does not belong to this league' };
  }

  // Check if team is already claimed
  if (team.isClaimed) {
    return { success: false, message: 'Team is already claimed by another manager' };
  }

  // Use transaction to ensure atomic operation
  const result = await prisma.$transaction(async (tx) => {
    // Check for existing membership in this league
    const existingMembership = await tx.leagueMembership.findUnique({
      where: {
        user_league_unique: {
          userId,
          leagueId: team.leagueId,
        },
      },
    });

    if (existingMembership) {
      // Check if user already manages a different team
      if (existingMembership.teamId && existingMembership.teamId !== teamId) {
        throw new Error('You already manage a team in this league');
      }

      // Update existing membership with teamId
      // Preserve commissioner role if they have it, otherwise upgrade to manager
      const newRole = existingMembership.role === 'commissioner' ? 'commissioner' : 'manager';

      await tx.leagueMembership.update({
        where: { id: existingMembership.id },
        data: {
          role: newRole,
          teamId,
        },
      });
    } else {
      // Create new membership with manager role and approved status
      await tx.leagueMembership.create({
        data: {
          userId,
          leagueId: team.leagueId,
          teamId,
          role: 'manager',
          status: 'approved',
        },
      });
    }

    // Mark team as claimed
    const updatedTeam = await tx.team.update({
      where: { id: teamId },
      data: {
        isClaimed: true,
        claimedBy: userId,
      },
    });

    return updatedTeam;
  });

  // Invalidate the server-side teams cache so the list refreshes
  revalidateTag(`teams-${leagueSlug}`);

  // Transform to Team type expected by frontend
  const transformedTeam: Team = {
    id: result.id,
    leagueId: result.leagueId,
    name: result.name,
    ownerUsername: result.ownerUsername || '',
    sleeperUsername: result.sleeperUsername || '',
    ownerId: result.managerId || undefined,
    managerId: result.managerId || '',
    avatarUrl: result.avatarUrl || undefined,
    record: {
      wins: result.wins,
      losses: result.losses,
      ties: result.ties,
    },
    isClaimed: result.isClaimed,
    claimedBy: result.claimedBy || undefined,
  };

  return {
    success: true,
    team: transformedTeam,
  };
}
