// tests/backend/be-task-04.test.ts
// Backend Test: Create League Memberships Table Schema

import { describe, test, expect, afterEach, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create League Memberships Table Schema (task-04)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  const testRunId = Date.now();

  afterEach(async () => {
    // Clean up in order (memberships first, then leagues, users)
    await prisma.leagueMembership.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('memberships table exists with required fields', async () => {
    // Create test user and league
    const user = await prisma.user.create({
      data: { email: `TEST_member_${testRunId}@example.com`, name: 'TEST_Member' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: `test_membership_league_${testRunId}`,
        name: 'TEST_Membership League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const membership = await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'manager',
        status: 'approved',
      },
    });

    expect(membership).toBeDefined();
    if (membership) {
      expect(membership.id).toBeDefined();
      expect(membership.userId).toBe(user.id);
      expect(membership.leagueId).toBe(league!.id);
      expect(membership.role).toBe('manager');
    }
  });

  test('supports all role types: commissioner, admin, manager, fan', async () => {
    const user = await prisma.user.create({
      data: { email: `TEST_roles_${testRunId}@example.com`, name: 'TEST_Roles' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: `test_roles_league_${testRunId}`,
        name: 'TEST_Roles League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const roles = ['commissioner', 'admin', 'manager', 'fan'] as const;

    for (const role of roles) {
      // Create new user for each role test
      const roleUser = await prisma.user.create({
        data: { email: `TEST_role_${role}_${testRunId}@example.com`, name: `TEST_${role}` },
      });

      const membership = await prisma.leagueMembership.create({
        data: {
          userId: roleUser.id,
          leagueId: league.id,
          role: role,
          status: 'approved',
        },
      });

      expect(membership.role).toBe(role);

      // Clean up
      await prisma.leagueMembership.delete({ where: { id: membership.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: roleUser.id } }).catch(() => {});
    }
  });

  test('enforces compound unique constraint on userId + leagueId', async () => {
    const user = await prisma.user.create({
      data: { email: `TEST_unique_member_${testRunId}@example.com`, name: 'TEST_UniqueMember' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: `test_unique_membership_${testRunId}`,
        name: 'TEST_Unique Membership',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'fan',
        status: 'approved',
      },
    });

    // Attempt to create duplicate membership
    await expect(
      prisma.leagueMembership.create({
        data: {
          userId: user.id,
          leagueId: league.id,
          role: 'manager',
          status: 'approved',
        },
      })
    ).rejects.toThrow(/unique/i);
  });

  test('supports optional teamId for manager role', async () => {
    const user = await prisma.user.create({
      data: { email: `TEST_manager_team_${testRunId}@example.com`, name: 'TEST_ManagerTeam' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: `test_manager_team_league_${testRunId}`,
        name: 'TEST_Manager Team League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Manager Team',
        ownerUsername: `test_owner_${testRunId}`,
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const membership = await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'manager',
        teamId: team.id,
        status: 'approved',
      },
    });

    expect(membership.teamId).toBe(team.id);

    // Clean up team
    await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
  });
});
