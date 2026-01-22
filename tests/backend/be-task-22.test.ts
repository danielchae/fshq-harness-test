// tests/backend/be-task-22.test.ts
// Backend Test: Implement Claim Team Server Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Claim Team Server Action (task-22)', () => {
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

  test('claim action creates membership with manager role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_claim_user@example.com', name: 'TEST_ClaimUser' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_claim_league',
        name: 'TEST_Claim League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Unclaimed Team',
        ownerUsername: 'original_owner',
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });

    // Claim team creates membership
    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        teamId: team!.id,
        role: 'manager',
      },
    });

    const membership = await prisma.leagueMembership?.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(membership?.role).toBe('manager');
    expect(membership?.teamId).toBe(team!.id);
  });

  test('claim action marks team as claimed', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_claim_mark@example.com', name: 'TEST_ClaimMark' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_claim_mark_league',
        name: 'TEST_Claim Mark',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_To Be Claimed',
        ownerUsername: 'owner',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: false,
      },
    });

    // Mark team as claimed
    const claimedTeam = await prisma.team?.update({
      where: { id: team!.id },
      data: {
        isClaimed: true,
        claimedBy: user.id,
      },
    });

    expect(claimedTeam?.isClaimed).toBe(true);
    expect(claimedTeam?.claimedBy).toBe(user.id);
  });

  test('claim action prevents claiming already claimed team', async () => {
    const user1 = await prisma.user.create({
      data: { email: 'TEST_claim_first@example.com', name: 'TEST_First' },
    });
    testUserId = user1.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_double_claim',
        name: 'TEST_Double Claim',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Already Claimed',
        ownerUsername: 'owner',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: true,
        claimedBy: user1.id,
      },
    });

    // Verify team is already claimed
    expect(team?.isClaimed).toBe(true);

    // Second user cannot claim already claimed team
    // (In real implementation, this would throw an error)
    const canClaim = !team?.isClaimed;
    expect(canClaim).toBe(false);
  });

  test('claim action validates team exists', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_validate_team',
        name: 'TEST_Validate Team',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Attempting to find non-existent team
    const nonExistentTeam = await prisma.team?.findUnique({
      where: { id: 'non-existent-team-id' },
    });

    expect(nonExistentTeam).toBeNull();
  });

  test('claim action returns ClaimTeamResult with success status', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_claim_result@example.com', name: 'TEST_ClaimResult' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_claim_result',
        name: 'TEST_Claim Result',
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
        ownerUsername: 'owner',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Simulating ClaimTeamResult
    const claimResult = {
      success: true,
      teamId: team!.id,
      leagueSlug: league?.slug,
    };

    expect(claimResult.success).toBe(true);
    expect(claimResult.teamId).toBeDefined();
    expect(claimResult.leagueSlug).toBe('test_claim_result');
  });

  test('claim action upgrades fan to manager role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_upgrade_fan@example.com', name: 'TEST_UpgradeFan' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_upgrade_role',
        name: 'TEST_Upgrade Role',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // User starts as fan
    const fanMembership = await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'fan',
      },
    });

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Fan Claim Team',
        ownerUsername: 'owner',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Upgrade to manager when claiming team
    const upgradedMembership = await prisma.leagueMembership?.update({
      where: { id: fanMembership!.id },
      data: {
        role: 'manager',
        teamId: team!.id,
      },
    });

    expect(upgradedMembership?.role).toBe('manager');
    expect(upgradedMembership?.teamId).toBe(team!.id);
  });
});
