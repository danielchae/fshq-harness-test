// tests/backend/be-task-65.test.ts
// Backend Test: Implement Validate Team Claim Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { validateTeamClaim } from '@/data/teams/validate-claim';

describe('Backend: Implement Validate Team Claim Action (task-65)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.leagueMembership?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('validates team exists in league', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_exists',
        name: 'TEST_Validate Exists',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Existing Team',
        ownerUsername: 'exists_user',
        sleeperUsername: 'exists_user',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Test: Team exists - should pass validation
    const result = await validateTeamClaim({
      teamId: team!.id,
      userSleeperUsername: 'exists_user',
      leagueSlug: 'test_validate_exists',
    });

    expect(result.valid).toBe(true);
    expect(result.teamId).toBe(team!.id);
    expect(result.teamName).toBe('TEST_Existing Team');
  });

  test('returns error when team does not exist', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_no_team',
        name: 'TEST_Validate No Team',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Test: Non-existent team ID
    const result = await validateTeamClaim({
      teamId: 'non-existent-team-id',
      userSleeperUsername: 'any_user',
      leagueSlug: 'test_validate_no_team',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain('not found');
  });

  test('validates team is not already claimed', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_validate_claimed@example.com', name: 'TEST_ValidateClaimed' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_claimed',
        name: 'TEST_Validate Claimed',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Claimed team
    const claimedTeam = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Claimed Team',
        ownerUsername: 'claimed_user',
        sleeperUsername: 'claimed_user',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: true,
        claimedBy: user.id,
      },
    });

    // Test: Already claimed team should fail validation
    const result = await validateTeamClaim({
      teamId: claimedTeam!.id,
      userSleeperUsername: 'claimed_user',
      leagueSlug: 'test_validate_claimed',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain('already claimed');
  });

  test('validates user is not already managing another team', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_validate_managing@example.com', name: 'TEST_ValidateManaging' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_managing',
        name: 'TEST_Validate Managing',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_First Team',
        ownerUsername: 'first',
        sleeperUsername: 'first',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Second Team',
        ownerUsername: 'second',
        sleeperUsername: 'second',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // User already manages team1
    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        teamId: team1!.id,
        role: 'manager',
        status: 'approved',
      },
    });

    // Test: User trying to claim team2 should fail
    const result = await validateTeamClaim({
      teamId: team2!.id,
      userSleeperUsername: 'second',
      leagueSlug: 'test_validate_managing',
      userId: user.id,
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain('already managing another team');
  });

  test('returns ValidateClaimResult with validation status for valid claim', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_result',
        name: 'TEST_Validate Result',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Result Team',
        ownerUsername: 'result_user',
        sleeperUsername: 'result_user',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: false,
      },
    });

    // Test: Valid claim should return success
    const result = await validateTeamClaim({
      teamId: team!.id,
      userSleeperUsername: 'result_user',
      leagueSlug: 'test_validate_result',
    });

    expect(result.valid).toBe(true);
    expect(result.teamId).toBe(team!.id);
    expect(result.teamName).toBe('TEST_Result Team');
    expect(result.message).toBeUndefined();
  });

  test('returns validation errors for invalid claims', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_validate_errors@example.com', name: 'TEST_ValidateErrors' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_errors',
        name: 'TEST_Validate Errors',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const claimedTeam = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Error Team',
        ownerUsername: 'error',
        sleeperUsername: 'error',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: true,
        claimedBy: 'other-user-id',
      },
    });

    // Test: Claimed team should return error
    const result = await validateTeamClaim({
      teamId: claimedTeam!.id,
      userSleeperUsername: 'error',
      leagueSlug: 'test_validate_errors',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('already claimed');
  });

  test('validates team belongs to correct league', async () => {
    const league1 = await prisma.league?.create({
      data: {
        slug: 'test_validate_league1',
        name: 'TEST_Validate League 1',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league1?.id || null;

    const league2 = await prisma.league?.create({
      data: {
        slug: 'test_validate_league2',
        name: 'TEST_Validate League 2',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });

    const teamInLeague1 = await prisma.team?.create({
      data: {
        leagueId: league1!.id,
        name: 'TEST_League1 Team',
        ownerUsername: 'l1team',
        sleeperUsername: 'l1team',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Test: Try to validate team in wrong league
    const result = await validateTeamClaim({
      teamId: teamInLeague1!.id,
      userSleeperUsername: 'l1team',
      leagueSlug: 'test_validate_league2', // Wrong league!
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain('not found');

    // Cleanup second league
    await prisma.league?.delete({ where: { id: league2!.id } });
  });

  test('allows fans to validate claim eligibility', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_validate_fan@example.com', name: 'TEST_ValidateFan' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_fan',
        name: 'TEST_Validate Fan',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // User is a fan (no team assigned)
    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'fan',
        status: 'approved',
        teamId: null,
      },
    });

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Fan Target Team',
        ownerUsername: 'fantarget',
        sleeperUsername: 'fantarget',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: false,
      },
    });

    // Test: Fan with no team can validate claim on unclaimed team
    const result = await validateTeamClaim({
      teamId: team!.id,
      userSleeperUsername: 'fantarget',
      leagueSlug: 'test_validate_fan',
      userId: user.id,
    });

    expect(result.valid).toBe(true);
    expect(result.teamId).toBe(team!.id);
  });

  test('validates sleeper username match', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_username',
        name: 'TEST_Validate Username',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Username Team',
        ownerUsername: 'owner_username',
        sleeperUsername: 'sleeper_username',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: false,
      },
    });

    // Test: Wrong username should fail
    const wrongResult = await validateTeamClaim({
      teamId: team!.id,
      userSleeperUsername: 'wrong_username',
      leagueSlug: 'test_validate_username',
    });

    expect(wrongResult.valid).toBe(false);
    expect(wrongResult.message).toContain('does not match');

    // Test: Correct username should pass
    const correctResult = await validateTeamClaim({
      teamId: team!.id,
      userSleeperUsername: 'sleeper_username',
      leagueSlug: 'test_validate_username',
    });

    expect(correctResult.valid).toBe(true);
  });

  test('returns error when league not found', async () => {
    // Test: Non-existent league
    const result = await validateTeamClaim({
      teamId: 'any-team-id',
      userSleeperUsername: 'any_user',
      leagueSlug: 'non-existent-league',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain('League not found');
  });
});
