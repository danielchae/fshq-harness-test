// tests/backend/be-task-14.test.ts
// Backend Test: Create League History and Engagement Metrics Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create League History and Engagement Metrics Schema (task-14)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.seasonHistory?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.engagementMetrics?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('seasonHistory table exists with required fields', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_history_league',
        name: 'TEST_History League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const history = await prisma.seasonHistory?.create({
      data: {
        leagueId: league!.id,
        year: 2024,
        champion: 'TEST_Champion Team',
        runnerUp: 'TEST_Runner Up',
        totalMembers: 12,
      },
    });

    expect(history).toBeDefined();
    if (history) {
      expect(history.id).toBeDefined();
      expect(history.leagueId).toBe(league!.id);
      expect(history.year).toBe(2024);
      expect(history.champion).toBe('TEST_Champion Team');
      expect(history.runnerUp).toBe('TEST_Runner Up');
      expect(history.totalMembers).toBe(12);
    }
  });

  test('stores multiple seasons of history', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_multi_history',
        name: 'TEST_Multi History',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const years = [2020, 2021, 2022, 2023, 2024];

    for (const year of years) {
      await prisma.seasonHistory?.create({
        data: {
          leagueId: league!.id,
          year,
          champion: `TEST_Champion ${year}`,
          runnerUp: `TEST_Runner ${year}`,
          totalMembers: 10 + (year - 2020),
        },
      });
    }

    const histories = await prisma.seasonHistory?.findMany({
      where: { leagueId: league!.id },
      orderBy: { year: 'desc' },
    });

    expect(histories?.length).toBe(5);
    expect(histories?.[0].year).toBe(2024);
    expect(histories?.[4].year).toBe(2020);
  });

  test('engagementMetrics table tracks weekly activity', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_engagement_league',
        name: 'TEST_Engagement League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const metrics = await prisma.engagementMetrics?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 5,
        momentsCreated: 25,
        commentsCount: 150,
        reactionsCount: 500,
      },
    });

    expect(metrics).toBeDefined();
    if (metrics) {
      expect(metrics.leagueId).toBe(league!.id);
      expect(metrics.weekNumber).toBe(5);
      expect(metrics.momentsCreated).toBe(25);
      expect(metrics.commentsCount).toBe(150);
      expect(metrics.reactionsCount).toBe(500);
    }
  });

  test('LeagueHistoryResponse type matches frontend expectations', async () => {
    // Frontend displays past seasons and all-time records
    const league = await prisma.league?.create({
      data: {
        slug: 'test_history_type',
        name: 'TEST_History Type',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const history = await prisma.seasonHistory?.create({
      data: {
        leagueId: league!.id,
        year: 2023,
        champion: 'TEST_Type Champion',
        runnerUp: 'TEST_Type Runner',
        totalMembers: 12,
        championshipScore: '145.5 - 122.3',
      },
    });

    expect(history).toHaveProperty('leagueId');
    expect(history).toHaveProperty('year');
    expect(history).toHaveProperty('champion');
    expect(history).toHaveProperty('runnerUp');
    expect(history).toHaveProperty('totalMembers');
  });

  test('supports optional fields for detailed history', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_detailed_history',
        name: 'TEST_Detailed History',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const history = await prisma.seasonHistory?.create({
      data: {
        leagueId: league!.id,
        year: 2024,
        champion: 'TEST_Detailed Champ',
        runnerUp: 'TEST_Detailed Runner',
        totalMembers: 12,
        championshipScore: '156.8 - 148.2',
        thirdPlace: 'TEST_Third Place',
        regularSeasonWinner: 'TEST_Top Seed',
      },
    });

    expect(history?.championshipScore).toBe('156.8 - 148.2');
    expect(history?.thirdPlace).toBe('TEST_Third Place');
    expect(history?.regularSeasonWinner).toBe('TEST_Top Seed');
  });
});
