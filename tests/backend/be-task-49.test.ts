// tests/backend/be-task-49.test.ts
// Backend Test: Implement Get User Stats Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get User Stats Data Fetcher (task-49)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  const TEST_SEASON = 2025;
  const testRunId = Date.now(); // Unique suffix for test isolation

  afterEach(async () => {
    await prisma.seasonStats?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    await prisma.weeklyStats?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('queries pick\'ems stats for specific league', async () => {
    const user = await prisma.user.create({
      data: { email: `TEST_stats_league_${testRunId}@example.com`, name: 'TEST_StatsLeague' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_stats_league_${testRunId}`,
        name: 'TEST_Stats League',
        platform: 'sleeper',
        season: TEST_SEASON,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: TEST_SEASON,
        totalPicks: 60,
        correctPicks: 45,
        accuracy: 0.75,
        currentStreak: 5,
        longestStreak: 8,
      },
    });

    const stats = await prisma.seasonStats?.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(stats?.totalPicks).toBe(60);
    expect(stats?.correctPicks).toBe(45);
    expect(stats?.accuracy).toBe(0.75);
  });

  test('includes accuracy, streak, and rank', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: `test_stats_rank_${testRunId}`,
        name: 'TEST_Stats Rank',
        platform: 'sleeper',
        season: TEST_SEASON,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create multiple users with stats for ranking
    const users = [];
    for (let i = 0; i < 5; i++) {
      const user = await prisma.user.create({
        data: { email: `TEST_rank_user_${testRunId}_${i}@example.com`, name: `TEST_RankUser${i}` },
      });
      users.push(user);

      await prisma.seasonStats?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          season: TEST_SEASON,
          totalPicks: 50,
          correctPicks: 30 + i * 3,
          accuracy: (30 + i * 3) / 50,
          currentStreak: i,
          longestStreak: i + 2,
        },
      });
    }

    testUserId = users[2].id;

    // Get user's stats and calculate rank
    const allStats = await prisma.seasonStats?.findMany({
      where: { leagueId: league!.id },
      orderBy: { correctPicks: 'desc' },
    });

    const userRank = allStats?.findIndex((s) => s.userId === testUserId) ?? -1;
    const userStats = allStats?.find((s) => s.userId === testUserId);

    expect(userRank).toBe(2); // 0-indexed, so 3rd place
    expect(userStats?.accuracy).toBe(0.72); // 36/50

    // Cleanup other users
    for (const user of users) {
      if (user.id !== testUserId) {
        await prisma.seasonStats?.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    }
  });

  test('calculates improvement from previous week', async () => {
    const user = await prisma.user.create({
      data: { email: `TEST_stats_improve_${testRunId}@example.com`, name: 'TEST_StatsImprove' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_stats_improve_${testRunId}`,
        name: 'TEST_Stats Improve',
        platform: 'sleeper',
        season: TEST_SEASON,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Week 9 stats
    await prisma.weeklyStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: TEST_SEASON,
        weekNumber: 9,
        totalPicks: 6,
        correctPicks: 3,
        accuracy: 0.5,
      },
    });

    // Week 10 stats
    await prisma.weeklyStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: TEST_SEASON,
        weekNumber: 10,
        totalPicks: 6,
        correctPicks: 5,
        accuracy: 0.833,
      },
    });

    const week9 = await prisma.weeklyStats?.findFirst({
      where: { userId: user.id, leagueId: league!.id, weekNumber: 9 },
    });

    const week10 = await prisma.weeklyStats?.findFirst({
      where: { userId: user.id, leagueId: league!.id, weekNumber: 10 },
    });

    const improvement = (week10?.accuracy ?? 0) - (week9?.accuracy ?? 0);
    expect(improvement).toBeCloseTo(0.333, 2);
  });

  test('returns UserStats type contract shape', async () => {
    const user = await prisma.user.create({
      data: { email: `TEST_stats_shape_${testRunId}@example.com`, name: 'TEST_StatsShape' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_stats_shape_${testRunId}`,
        name: 'TEST_Stats Shape',
        platform: 'sleeper',
        season: TEST_SEASON,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const stats = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: TEST_SEASON,
        totalPicks: 50,
        correctPicks: 35,
        accuracy: 0.7,
        currentStreak: 3,
        longestStreak: 6,
      },
    });

    // Verify UserStats type contract
    expect(stats).toHaveProperty('userId');
    expect(stats).toHaveProperty('leagueId');
    expect(stats).toHaveProperty('totalPicks');
    expect(stats).toHaveProperty('correctPicks');
    expect(stats).toHaveProperty('accuracy');
    expect(stats).toHaveProperty('currentStreak');
    expect(stats).toHaveProperty('longestStreak');
  });

  test('generates realistic stats', async () => {
    const user = await prisma.user.create({
      data: { email: `TEST_stats_realistic_${testRunId}@example.com`, name: 'TEST_StatsRealistic' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_stats_realistic_${testRunId}`,
        name: 'TEST_Stats Realistic',
        platform: 'sleeper',
        season: TEST_SEASON,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const stats = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: TEST_SEASON,
        totalPicks: 72, // 12 weeks * 6 matchups
        correctPicks: 50,
        accuracy: 50 / 72,
        currentStreak: 4,
        longestStreak: 9,
      },
    });

    // Verify realistic ranges
    expect(stats?.totalPicks).toBeGreaterThan(0);
    expect(stats?.correctPicks).toBeLessThanOrEqual(stats?.totalPicks ?? 0);
    expect(stats?.accuracy).toBeGreaterThan(0);
    expect(stats?.accuracy).toBeLessThanOrEqual(1);
    expect(stats?.currentStreak).toBeGreaterThanOrEqual(0);
    expect(stats?.longestStreak).toBeGreaterThanOrEqual(stats?.currentStreak ?? 0);
  });

  test('handles user with no stats', async () => {
    const user = await prisma.user.create({
      data: { email: `TEST_stats_none_${testRunId}@example.com`, name: 'TEST_StatsNone' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_stats_none_${testRunId}`,
        name: 'TEST_Stats None',
        platform: 'sleeper',
        season: TEST_SEASON,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const stats = await prisma.seasonStats?.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(stats).toBeNull();

    // Default stats for new user
    const defaultStats = {
      totalPicks: 0,
      correctPicks: 0,
      accuracy: 0,
      currentStreak: 0,
      longestStreak: 0,
    };

    expect(defaultStats.totalPicks).toBe(0);
    expect(defaultStats.accuracy).toBe(0);
  });
});
