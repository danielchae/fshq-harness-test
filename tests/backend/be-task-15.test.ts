// tests/backend/be-task-15.test.ts
// Backend Test: Implement Row-Level Security Policies

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getUserRoleInLeague, canAccessLeague, canModifyLeagueSettings, hasRolePermission } from '@/lib/auth/rls-policies';

describe('Backend: Implement Row-Level Security Policies (task-15)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  let testCommissionerId: string | null = null;

  afterEach(async () => {
    // Clean up memberships first (foreign key constraint)
    await prisma.leagueMembership.deleteMany({
      where: {
        OR: [
          { userId: testUserId || '' },
          { userId: testCommissionerId || '' }
        ]
      }
    }).catch(() => {});
    await prisma.leagueSettings.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
    if (testCommissionerId) {
      await prisma.user.delete({ where: { id: testCommissionerId } }).catch(() => {});
      testCommissionerId = null;
    }
  });

  test('users can only view leagues they are members of', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_member_user@example.com', name: 'TEST_MemberUser' },
    });
    testUserId = user.id;

    const league1 = await prisma.league.create({
      data: {
        slug: 'test_member_league',
        name: 'TEST_Member League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'private',
      },
    });
    testLeagueId = league1.id;

    // Create approved membership for user
    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league1.id,
        role: 'fan',
        status: 'approved',
      },
    });

    // Test RLS policy: user can access the league they are a member of
    const canAccess = await canAccessLeague(user.id, league1.id);
    expect(canAccess).toBe(true);

    // Query leagues where user has membership
    const memberships = await prisma.leagueMembership.findMany({
      where: { userId: user.id, status: 'approved' },
      include: { league: true },
    });

    expect(memberships.length).toBe(1);
    expect(memberships[0].league.slug).toBe('test_member_league');
  });

  test('commissioner role can modify league settings', async () => {
    const commissioner = await prisma.user.create({
      data: { email: 'TEST_commissioner@example.com', name: 'TEST_Commissioner' },
    });
    testCommissionerId = commissioner.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_settings_rls',
        name: 'TEST_Settings RLS League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Create commissioner membership
    const membership = await prisma.leagueMembership.create({
      data: {
        userId: commissioner.id,
        leagueId: league.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    // Create league settings
    const settings = await prisma.leagueSettings.create({
      data: {
        leagueId: league.id,
        pickemsEnabled: true,
        powerRankingsEnabled: true,
        bracketEnabled: false,
      },
    });

    // Verify commissioner role exists
    expect(membership.role).toBe('commissioner');

    // Test RLS policy: commissioner can modify league settings
    const canModify = await canModifyLeagueSettings(commissioner.id, league.id);
    expect(canModify).toBe(true);

    // Commissioner can update settings
    const updatedSettings = await prisma.leagueSettings.update({
      where: { id: settings.id },
      data: { bracketEnabled: true },
    });

    expect(updatedSettings.bracketEnabled).toBe(true);
  });

  test('different users can have different roles in same league', async () => {
    const commissioner = await prisma.user.create({
      data: { email: 'TEST_comm_role@example.com', name: 'TEST_CommRole' },
    });
    testCommissionerId = commissioner.id;

    const fan = await prisma.user.create({
      data: { email: 'TEST_fan_role@example.com', name: 'TEST_FanRole' },
    });
    testUserId = fan.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_multi_role',
        name: 'TEST_Multi Role League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    await prisma.leagueMembership.create({
      data: {
        userId: commissioner.id,
        leagueId: league.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    await prisma.leagueMembership.create({
      data: {
        userId: fan.id,
        leagueId: league.id,
        role: 'fan',
        status: 'approved',
      },
    });

    const memberships = await prisma.leagueMembership.findMany({
      where: { leagueId: league.id },
    });

    expect(memberships.length).toBe(2);

    const commMembership = memberships.find(m => m.userId === commissioner.id);
    const fanMembership = memberships.find(m => m.userId === fan.id);

    expect(commMembership?.role).toBe('commissioner');
    expect(fanMembership?.role).toBe('fan');

    // Test RLS policy: commissioner has higher permission than fan
    expect(hasRolePermission('commissioner', 'fan')).toBe(true);
    expect(hasRolePermission('fan', 'commissioner')).toBe(false);

    // Commissioner can modify settings, fan cannot
    const commCanModify = await canModifyLeagueSettings(commissioner.id, league.id);
    const fanCanModify = await canModifyLeagueSettings(fan.id, league.id);

    expect(commCanModify).toBe(true);
    expect(fanCanModify).toBe(false);
  });

  test('RLS helper function to check user role', async () => {
    // This tests that we can implement role checking logic using RLS policies
    const user = await prisma.user.create({
      data: { email: 'TEST_role_check@example.com', name: 'TEST_RoleCheck' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_role_check',
        name: 'TEST_Role Check League',
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
        role: 'admin',
        status: 'approved',
      },
    });

    // Test using the actual RLS policy function
    const role = await getUserRoleInLeague(user.id, league.id);
    expect(role).toBe('admin');

    const noRole = await getUserRoleInLeague('non-existent-user', league.id);
    expect(noRole).toBeNull();
  });
});
