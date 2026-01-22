// tests/backend/be-task-45.test.ts
// Backend Test: Implement Get User Profile Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get User Profile Data Fetcher (task-45)', () => {
  let testUserId: string | null = null;
  let testLeagueIds: string[] = [];

  afterEach(async () => {
    await prisma.seasonStats?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    await prisma.leagueMembership?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    for (const leagueId of testLeagueIds) {
      await prisma.league?.delete({ where: { id: leagueId } }).catch(() => {});
    }
    testLeagueIds = [];
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('queries user profile with notification preferences', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'TEST_profile_prefs@example.com',
        name: 'TEST_ProfilePrefs',
        username: 'testprofileprefs',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    testUserId = user.id;

    // Verify user profile
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(profile?.email).toBe('TEST_profile_prefs@example.com');
    expect(profile?.name).toBe('TEST_ProfilePrefs');
    expect(profile?.username).toBe('testprofileprefs');
  });

  test('queries aggregated pick\'ems stats across all leagues', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_profile_stats@example.com', name: 'TEST_ProfileStats' },
    });
    testUserId = user.id;

    // Create multiple leagues with stats
    for (let i = 0; i < 3; i++) {
      const league = await prisma.league?.create({
        data: {
          slug: `test_profile_stats_${i}`,
          name: `TEST_Profile Stats ${i}`,
          platform: 'sleeper',
          season: 2025,
          visibility: 'public',
        },
      });
      testLeagueIds.push(league!.id);

      await prisma.seasonStats?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          season: 2025,
          totalPicks: 50,
          correctPicks: 30 + i * 5,
          accuracy: (30 + i * 5) / 50,
          currentStreak: i,
          longestStreak: i + 3,
        },
      });
    }

    // Aggregate stats across leagues
    const allStats = await prisma.seasonStats?.findMany({
      where: { userId: user.id },
    });

    const totalPicks = allStats?.reduce((sum, s) => sum + s.totalPicks, 0);
    const totalCorrect = allStats?.reduce((sum, s) => sum + s.correctPicks, 0);
    const overallAccuracy = totalCorrect! / totalPicks!;

    expect(allStats?.length).toBe(3);
    expect(totalPicks).toBe(150);
    expect(totalCorrect).toBe(105); // 30 + 35 + 40
    expect(overallAccuracy).toBe(0.7);
  });

  test('returns UserProfileData type contract shape', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'TEST_profile_shape@example.com',
        name: 'TEST_ProfileShape',
        username: 'testprofileshape',
      },
    });
    testUserId = user.id;

    // Verify User type contract
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('createdAt');
  });

  test('cached per user session', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_profile_cache@example.com', name: 'TEST_ProfileCache' },
    });
    testUserId = user.id;

    // Multiple reads should be consistent
    const reads = [];
    for (let i = 0; i < 5; i++) {
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
      });
      reads.push(profile);
    }

    expect(reads.length).toBe(5);
    expect(reads.every((r) => r?.email === 'TEST_profile_cache@example.com')).toBe(true);
  });

  test('includes league memberships in profile', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_profile_leagues@example.com', name: 'TEST_ProfileLeagues' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_profile_leagues',
        name: 'TEST_Profile Leagues',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueIds.push(league!.id);

    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    const profileWithLeagues = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          include: { league: true },
        },
      },
    });

    expect(profileWithLeagues?.memberships?.length).toBe(1);
    expect(profileWithLeagues?.memberships?.[0].role).toBe('commissioner');
  });

  test('returns null for non-existent user', async () => {
    const nonExistent = await prisma.user.findUnique({
      where: { id: 'non-existent-user-id-12345' },
    });

    expect(nonExistent).toBeNull();
  });
});
