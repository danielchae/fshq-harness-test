import { prisma } from '@/lib/db';

export interface ValidateClaimInput {
  teamId: string;
  userSleeperUsername: string;
  leagueSlug: string;
  userId?: string; // Optional - if provided, validates user is not managing another team
}

export interface ValidateClaimResult {
  valid: boolean;
  message?: string;
  teamId?: string;
  teamName?: string;
}

/**
 * Validates a team claim request before actually claiming the team.
 *
 * Validation checks:
 * 1. Team exists in the specified league
 * 2. Team is not already claimed by another user
 * 3. Sleeper username matches team owner (identity verification)
 * 4. User is not already managing another team in this league (if userId provided)
 */
export async function validateTeamClaim(input: ValidateClaimInput): Promise<ValidateClaimResult> {
  const { teamId, userSleeperUsername, leagueSlug, userId } = input;

  // Step 1: Find the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
  });

  if (!league) {
    return { valid: false, message: 'League not found' };
  }

  // Step 2: Find the team and validate it exists in this league
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      leagueId: league.id,
    },
  });

  if (!team) {
    return { valid: false, message: 'Team not found in this league' };
  }

  // Step 3: Validate team is not already claimed
  if (team.isClaimed) {
    return { valid: false, message: 'Team is already claimed by another user' };
  }

  // Step 4: Validate Sleeper username matches team owner
  // The team's sleeperUsername or ownerUsername should match the user's Sleeper identity
  const teamSleeperUsername = team.sleeperUsername || team.ownerUsername;

  if (!teamSleeperUsername) {
    return { valid: false, message: 'Team has no associated Sleeper username' };
  }

  const isUsernameMatch = teamSleeperUsername.toLowerCase() === userSleeperUsername.toLowerCase();

  if (!isUsernameMatch) {
    return {
      valid: false,
      message: `Username does not match team owner (expected: ${teamSleeperUsername})`,
    };
  }

  // Step 5: If userId is provided, validate user is not already managing another team in this league
  if (userId) {
    const existingMembership = await prisma.leagueMembership.findFirst({
      where: {
        userId,
        leagueId: league.id,
        teamId: { not: null },
      },
    });

    if (existingMembership && existingMembership.teamId !== teamId) {
      return {
        valid: false,
        message: 'You are already managing another team in this league',
      };
    }
  }

  // All validations passed
  return {
    valid: true,
    teamId: team.id,
    teamName: team.name,
  };
}
