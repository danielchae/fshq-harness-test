// tests/backend/be-task-12.test.ts
// Backend Test: Create Pick'ems Stats Tables (Weekly/Season/All-Time)

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

// Generate unique suffix to avoid conflicts with concurrent test runs
const uniqueSuffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('Backend: Create Pick\'ems Stats Tables (task-12)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.weeklyStats?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    await prisma.seasonStats?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    await prisma.allTimeStats?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('weeklyStats table exists with required fields', async () => {
    const suffix = uniqueSuffix();
    const user = await prisma.user.create({
      data: { email: `TEST_weekly_stats_${suffix}@example.com`, name: 'TEST_WeeklyStats' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_weekly_stats_league_${suffix}`,
        name: 'TEST_Weekly Stats League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const weeklyStats = await prisma.weeklyStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
        totalPicks: 6,
        correctPicks: 4,
        accuracy: 66.67,
      },
    });

    expect(weeklyStats).toBeDefined();
    if (weeklyStats) {
      expect(weeklyStats.id).toBeDefined();
      expect(weeklyStats.userId).toBe(user.id);
      expect(weeklyStats.weekNumber).toBe(5);
      expect(weeklyStats.totalPicks).toBe(6);
      expect(weeklyStats.correctPicks).toBe(4);
      expect(weeklyStats.accuracy).toBe(66.67);
    }
  });

  test('seasonStats table exists with required fields', async () => {
    const suffix = uniqueSuffix();
    const user = await prisma.user.create({
      data: { email: `TEST_season_stats_${suffix}@example.com`, name: 'TEST_SeasonStats' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_season_stats_league_${suffix}`,
        name: 'TEST_Season Stats League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const seasonStats = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: 2025,
        totalPicks: 60,
        correctPicks: 45,
        accuracy: 75.0,
        currentStreak: 5,
        longestStreak: 8,
      },
    });

    expect(seasonStats).toBeDefined();
    if (seasonStats) {
      expect(seasonStats.id).toBeDefined();
      expect(seasonStats.season).toBe(2025);
      expect(seasonStats.totalPicks).toBe(60);
      expect(seasonStats.correctPicks).toBe(45);
      expect(seasonStats.accuracy).toBe(75.0);
      expect(seasonStats.currentStreak).toBe(5);
      expect(seasonStats.longestStreak).toBe(8);
    }
  });

  test('allTimeStats table exists with required fields', async () => {
    const suffix = uniqueSuffix();
    const user = await prisma.user.create({
      data: { email: `TEST_alltime_stats_${suffix}@example.com`, name: 'TEST_AllTimeStats' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_alltime_stats_league_${suffix}`,
        name: 'TEST_AllTime Stats League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const allTimeStats = await prisma.allTimeStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        totalPicks: 500,
        correctPicks: 375,
        accuracy: 75.0,
        seasonsPlayed: 5,
        bestSeasonAccuracy: 82.5,
        longestStreak: 15,
      },
    });

    expect(allTimeStats).toBeDefined();
    if (allTimeStats) {
      expect(allTimeStats.id).toBeDefined();
      expect(allTimeStats.totalPicks).toBe(500);
      expect(allTimeStats.correctPicks).toBe(375);
      expect(allTimeStats.seasonsPlayed).toBe(5);
      expect(allTimeStats.bestSeasonAccuracy).toBe(82.5);
      expect(allTimeStats.longestStreak).toBe(15);
    }
  });

  test('LeaderboardEntry type matches frontend expectations', async () => {
    // Frontend displays leaderboard with accuracy, streak, total correct
    const suffix = uniqueSuffix();
    const user = await prisma.user.create({
      data: { email: `TEST_leaderboard_${suffix}@example.com`, name: 'TEST_Leaderboard' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_leaderboard_league_${suffix}`,
        name: 'TEST_Leaderboard League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const seasonStats = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: 2025,
        totalPicks: 100,
        correctPicks: 78,
        accuracy: 78.0,
        currentStreak: 3,
        longestStreak: 10,
      },
    });

    expect(seasonStats).toHaveProperty('totalPicks');
    expect(seasonStats).toHaveProperty('correctPicks');
    expect(seasonStats).toHaveProperty('accuracy');
    expect(seasonStats).toHaveProperty('currentStreak');
    expect(seasonStats).toHaveProperty('longestStreak');
  });

  test('stats tables support streak calculations', async () => {
    const suffix = uniqueSuffix();
    const user = await prisma.user.create({
      data: { email: `TEST_streak_${suffix}@example.com`, name: 'TEST_Streak' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: `test_streak_league_${suffix}`,
        name: 'TEST_Streak League',
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
        accuracy: 70.0,
        currentStreak: 7,
        longestStreak: 12,
      },
    });

    expect(stats?.currentStreak).toBe(7);
    expect(stats?.longestStreak).toBe(12);

    // Update streak
    const updatedStats = await prisma.seasonStats?.update({
      where: { id: stats!.id },
      data: { currentStreak: 8 },
    });

    expect(updatedStats?.currentStreak).toBe(8);
  });
});
