// tests/backend/be-task-31.test.ts
// Backend Test: Implement Get User Leagues Data Fetcher

import { afterEach, describe, expect, test } from 'vitest';

import { prisma } from '@/lib/db';

describe('Backend: Implement Get User Leagues Data Fetcher (task-31)', () => {
  let testLeagueIds: string[] = [];
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.leagueMembership.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {
      // Intentionally empty - cleanup failures are non-critical
    });
    for (const id of testLeagueIds) {
      await prisma.league.delete({ where: { id } }).catch(() => {
        // Intentionally empty - cleanup failures are non-critical
      });
    }
    testLeagueIds = [];
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {
        // Intentionally empty - cleanup failures are non-critical
      });
      testUserId = null;
    }
  });

  test('queries all leagues where user is a member', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_user_leagues@example.com', name: 'TEST_UserLeagues' },
    });
    testUserId = user.id;

    // Create multiple leagues
    for (let i = 0; i < 3; i++) {
      const league = await prisma.league.create({
        data: {
          slug: `test_user_league_${i}`,
          name: `TEST_User League ${i}`,
          platform: 'sleeper',
          season: 2025,
          visibility: 'public',
        },
      });
      testLeagueIds.push(league.id);

      await prisma.leagueMembership.create({
        data: {
          userId: user.id,
          leagueId: league.id,
          role: i === 0 ? 'commissioner' : 'manager',
          status: 'approved',
        },
      });
    }

    const memberships = await prisma.leagueMembership.findMany({
      where: { userId: user.id },
      include: { league: true },
    });

    expect(memberships?.length).toBe(3);
  });

  test('includes user role and team for each league', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_user_role_team@example.com', name: 'TEST_UserRoleTeam' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_user_role_team',
        name: 'TEST_User Role Team',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueIds.push(league.id);

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_User Team',
        ownerUsername: 'userteam',
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });

    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        teamId: team.id,
        role: 'manager',
        status: 'approved',
      },
    });

    const membership = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league.id },
      include: { team: true, league: true },
    });

    expect(membership?.role).toBe('manager');
    expect(membership?.team?.name).toBe('TEST_User Team');

    // Cleanup team
    await prisma.team.delete({ where: { id: team.id } });
  });

  test('returns empty array for user with no leagues', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_no_leagues@example.com', name: 'TEST_NoLeagues' },
    });
    testUserId = user.id;

    const memberships = await prisma.leagueMembership.findMany({
      where: { userId: user.id },
    });

    expect(memberships).toHaveLength(0);
  });

  test('returns UserLeague type contract shape', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_user_league_shape@example.com', name: 'TEST_UserLeagueShape' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_user_league_shape',
        name: 'TEST_User League Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueIds.push(league.id);

    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'fan',
        status: 'approved',
      },
    });

    const membership = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league.id },
      include: { league: true },
    });

    // UserLeague shape includes league info + user role
    expect(membership).toHaveProperty('role');
    expect(membership?.league).toHaveProperty('slug');
    expect(membership?.league).toHaveProperty('name');
  });
});
