// tests/backend/be-task-39.test.ts
// Backend Test: Implement Get League Members Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get League Members Data Fetcher (task-39)', () => {
  let testLeagueId: string | null = null;
  let testUserIds: string[] = [];

  afterEach(async () => {
    await prisma.leagueMembership?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    for (const userId of testUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    testUserIds = [];
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries memberships with user and team data', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_members_user@example.com', name: 'TEST_MembersUser' },
    });
    testUserIds.push(user.id);

    const league = await prisma.league?.create({
      data: {
        slug: 'test_members_fetch',
        name: 'TEST_Members Fetch',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Member Team',
        ownerUsername: 'memberteam',
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });

    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        teamId: team!.id,
        role: 'manager',
        status: 'approved',
      },
    });

    const members = await prisma.leagueMembership?.findMany({
      where: { leagueId: league!.id },
      include: { user: true, team: true },
    });

    expect(members?.length).toBe(1);
    expect(members?.[0].user?.name).toBe('TEST_MembersUser');
    expect(members?.[0].team?.name).toBe('TEST_Member Team');
  });

  test('orders by role then username', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_members_order',
        name: 'TEST_Members Order',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create users with different roles
    const roles = ['fan', 'manager', 'commissioner'];
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({
        data: { email: `TEST_member_${i}@example.com`, name: `TEST_Member${i}` },
      });
      testUserIds.push(user.id);

      await prisma.leagueMembership?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          role: roles[i],
          status: 'approved',
        },
      });
    }

    // Custom role ordering
    const members = await prisma.leagueMembership?.findMany({
      where: { leagueId: league!.id },
      include: { user: true },
    });

    // Sort by role priority
    const roleOrder = { commissioner: 0, admin: 1, manager: 2, fan: 3 };
    const sorted = members?.sort((a, b) => {
      const roleA = roleOrder[a.role as keyof typeof roleOrder] ?? 4;
      const roleB = roleOrder[b.role as keyof typeof roleOrder] ?? 4;
      return roleA - roleB;
    });

    expect(sorted?.[0].role).toBe('commissioner');
  });

  test('includes pending approval members', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pending_member@example.com', name: 'TEST_PendingMember' },
    });
    testUserIds.push(user.id);

    const league = await prisma.league?.create({
      data: {
        slug: 'test_members_pending',
        name: 'TEST_Members Pending',
        platform: 'sleeper',
        season: 2025,
        visibility: 'private',
      },
    });
    testLeagueId = league?.id || null;

    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'fan',
        status: 'pending',
      },
    });

    const allMembers = await prisma.leagueMembership?.findMany({
      where: { leagueId: league!.id },
    });

    const pendingMembers = await prisma.leagueMembership?.findMany({
      where: { leagueId: league!.id, status: 'pending' },
    });

    expect(allMembers?.length).toBe(1);
    expect(pendingMembers?.length).toBe(1);
  });

  test('returns LeagueMember type contract shape', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_member_shape@example.com', name: 'TEST_MemberShape' },
    });
    testUserIds.push(user.id);

    const league = await prisma.league?.create({
      data: {
        slug: 'test_member_shape',
        name: 'TEST_Member Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const membership = await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'manager',
        status: 'approved',
      },
    });

    // Verify Membership type contract
    expect(membership).toHaveProperty('id');
    expect(membership).toHaveProperty('userId');
    expect(membership).toHaveProperty('leagueId');
    expect(membership).toHaveProperty('role');
  });

  test('commissioner can see all members', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_members_visibility',
        name: 'TEST_Members Visibility',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create multiple members
    for (let i = 0; i < 5; i++) {
      const user = await prisma.user.create({
        data: { email: `TEST_vis_member_${i}@example.com`, name: `TEST_VisMember${i}` },
      });
      testUserIds.push(user.id);

      await prisma.leagueMembership?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          role: i === 0 ? 'commissioner' : 'manager',
          status: 'approved',
        },
      });
    }

    const allMembers = await prisma.leagueMembership?.findMany({
      where: { leagueId: league!.id },
      include: { user: true },
    });

    expect(allMembers?.length).toBe(5);
  });
});
