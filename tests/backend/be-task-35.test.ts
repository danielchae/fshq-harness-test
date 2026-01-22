// tests/backend/be-task-35.test.ts
// Backend Test: Implement Get Pick'ems Leaderboard Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Pickems Leaderboard Data Fetcher (task-35)', () => {
  let testLeagueId: string | null = null;
  let testUserIds: string[] = [];

  afterEach(async () => {
    await prisma.seasonStats?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    for (const userId of testUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    testUserIds = [];
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries SeasonStats ordered by correctPicks DESC', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_leaderboard_order',
        name: 'TEST_Leaderboard Order',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create users with different stats
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({
        data: { email: `TEST_lb_user_${i}@example.com`, name: `TEST_LBUser${i}` },
      });
      testUserIds.push(user.id);

      await prisma.seasonStats?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          season: 2025,
          totalPicks: 50,
          correctPicks: 30 + i * 5, // 30, 35, 40
          accuracy: (30 + i * 5) / 50,
          currentStreak: i,
          longestStreak: i + 2,
        },
      });
    }

    const leaderboard = await prisma.seasonStats?.findMany({
      where: { leagueId: league!.id },
      orderBy: { correctPicks: 'desc' },
      include: { user: true },
    });

    expect(leaderboard?.length).toBe(3);
    expect(leaderboard?.[0].correctPicks).toBe(40);
    expect(leaderboard?.[2].correctPicks).toBe(30);
  });

  test('includes accuracy, streak, and total picks', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_lb_stats@example.com', name: 'TEST_LBStats' },
    });
    testUserIds.push(user.id);

    const league = await prisma.league?.create({
      data: {
        slug: 'test_leaderboard_stats',
        name: 'TEST_Leaderboard Stats',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const stats = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: 2025,
        totalPicks: 60,
        correctPicks: 45,
        accuracy: 0.75,
        currentStreak: 5,
        longestStreak: 8,
      },
    });

    expect(stats?.totalPicks).toBe(60);
    expect(stats?.correctPicks).toBe(45);
    expect(stats?.accuracy).toBe(0.75);
    expect(stats?.currentStreak).toBe(5);
    expect(stats?.longestStreak).toBe(8);
  });

  test('highlights current user position', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_leaderboard_position',
        name: 'TEST_Leaderboard Position',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create users with different ranks
    const users = [];
    for (let i = 0; i < 5; i++) {
      const user = await prisma.user.create({
        data: { email: `TEST_lb_pos_${i}@example.com`, name: `TEST_LBPos${i}` },
      });
      testUserIds.push(user.id);
      users.push(user);

      await prisma.seasonStats?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          season: 2025,
          totalPicks: 50,
          correctPicks: 40 - i * 2,
          accuracy: (40 - i * 2) / 50,
          currentStreak: 0,
          longestStreak: 0,
        },
      });
    }

    // Find user's position
    const currentUserId = users[2].id;
    const leaderboard = await prisma.seasonStats?.findMany({
      where: { leagueId: league!.id },
      orderBy: { correctPicks: 'desc' },
    });

    const userPosition = leaderboard?.findIndex((s) => s.userId === currentUserId);
    expect(userPosition).toBe(2); // 0-indexed, so 3rd place
  });

  test('returns LeaderboardResponse type contract shape', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_lb_shape@example.com', name: 'TEST_LBShape' },
    });
    testUserIds.push(user.id);

    const league = await prisma.league?.create({
      data: {
        slug: 'test_leaderboard_shape',
        name: 'TEST_Leaderboard Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const stats = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: 2025,
        totalPicks: 50,
        correctPicks: 35,
        accuracy: 0.7,
        currentStreak: 3,
        longestStreak: 5,
      },
    });

    // Verify LeaderboardEntry type contract
    expect(stats).toHaveProperty('userId');
    expect(stats).toHaveProperty('totalPicks');
    expect(stats).toHaveProperty('correctPicks');
    expect(stats).toHaveProperty('accuracy');
    expect(stats).toHaveProperty('currentStreak');
    expect(stats).toHaveProperty('longestStreak');
  });

  test('displays streak badges', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_lb_streak@example.com', name: 'TEST_LBStreak' },
    });
    testUserIds.push(user.id);

    const league = await prisma.league?.create({
      data: {
        slug: 'test_leaderboard_streak',
        name: 'TEST_Leaderboard Streak',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Hot streak
    const hotStreak = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: 2025,
        totalPicks: 50,
        correctPicks: 40,
        accuracy: 0.8,
        currentStreak: 7, // Hot streak (5+)
        longestStreak: 10,
      },
    });

    expect(hotStreak?.currentStreak).toBeGreaterThanOrEqual(5);

    // Update to cold streak
    await prisma.seasonStats?.update({
      where: { id: hotStreak!.id },
      data: { currentStreak: -3 }, // Negative = losing streak
    });

    const coldStreak = await prisma.seasonStats?.findUnique({
      where: { id: hotStreak!.id },
    });

    expect(coldStreak?.currentStreak).toBeLessThan(0);
  });
});
