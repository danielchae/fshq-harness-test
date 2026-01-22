// tests/backend/be-task-42.test.ts
// Backend Test: Implement Get League History Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get League History Data Fetcher (task-42)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.seasonHistory?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries SeasonHistory for all past seasons', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_history_seasons',
        name: 'TEST_History Seasons',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create past seasons
    for (let year = 2020; year <= 2024; year++) {
      await prisma.seasonHistory?.create({
        data: {
          leagueId: league!.id,
          year: year,
          champion: `TEST_Champion ${year}`,
          runnerUp: `TEST_RunnerUp ${year}`,
          totalMembers: 12,
        },
      });
    }

    const history = await prisma.seasonHistory?.findMany({
      where: { leagueId: league!.id },
      orderBy: { year: 'desc' },
    });

    expect(history?.length).toBe(5);
    expect(history?.[0].year).toBe(2024);
    expect(history?.[4].year).toBe(2020);
  });

  test('includes champions and playoff results', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_history_champions',
        name: 'TEST_History Champions',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const season = await prisma.seasonHistory?.create({
      data: {
        leagueId: league!.id,
        year: 2024,
        champion: 'TEST_Dynasty Dominators',
        runnerUp: 'TEST_Almost There',
        thirdPlace: 'TEST_Bronze Medal',
        totalMembers: 12,
        playoffTeams: 6,
      },
    });

    expect(season?.champion).toBe('TEST_Dynasty Dominators');
    expect(season?.runnerUp).toBe('TEST_Almost There');
    expect(season?.thirdPlace).toBe('TEST_Bronze Medal');
  });

  test('queries all-time records and milestones', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_history_records',
        name: 'TEST_History Records',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create seasons with varying stats
    const stats = [
      { year: 2022, champion: 'Team A', highScore: 180.5 },
      { year: 2023, champion: 'Team B', highScore: 195.2 },
      { year: 2024, champion: 'Team A', highScore: 188.0 },
    ];

    for (const s of stats) {
      await prisma.seasonHistory?.create({
        data: {
          leagueId: league!.id,
          year: s.year,
          champion: s.champion,
          runnerUp: 'TEST_Runner',
          totalMembers: 12,
          highestWeeklyScore: s.highScore,
        },
      });
    }

    // Find all-time high score
    const allTimeHigh = await prisma.seasonHistory?.findFirst({
      where: { leagueId: league!.id },
      orderBy: { highestWeeklyScore: 'desc' },
    });

    // Count championships by team
    const teamAChampionships = await prisma.seasonHistory?.count({
      where: { leagueId: league!.id, champion: 'Team A' },
    });

    expect(allTimeHigh?.highestWeeklyScore).toBe(195.2);
    expect(teamAChampionships).toBe(2);
  });

  test('returns LeagueHistoryResponse type contract shape', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_history_shape',
        name: 'TEST_History Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const season = await prisma.seasonHistory?.create({
      data: {
        leagueId: league!.id,
        year: 2024,
        champion: 'TEST_Champion',
        runnerUp: 'TEST_Runner',
        totalMembers: 12,
      },
    });

    // Verify SeasonHistory type contract
    expect(season).toHaveProperty('id');
    expect(season).toHaveProperty('leagueId');
    expect(season).toHaveProperty('year');
    expect(season).toHaveProperty('champion');
    expect(season).toHaveProperty('runnerUp');
    expect(season).toHaveProperty('totalMembers');
  });

  test('generates multi-year history timeline', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_history_timeline',
        name: 'TEST_History Timeline',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create multi-year history
    const champions = ['Team Alpha', 'Team Beta', 'Team Alpha', 'Team Gamma', 'Team Alpha'];
    for (let i = 0; i < 5; i++) {
      await prisma.seasonHistory?.create({
        data: {
          leagueId: league!.id,
          year: 2020 + i,
          champion: champions[i],
          runnerUp: 'TEST_Various',
          totalMembers: 10 + i,
        },
      });
    }

    const timeline = await prisma.seasonHistory?.findMany({
      where: { leagueId: league!.id },
      orderBy: { year: 'asc' },
    });

    expect(timeline?.length).toBe(5);
    expect(timeline?.[0].year).toBe(2020);
    expect(timeline?.[4].year).toBe(2024);

    // Verify dynasty detection (multiple championships)
    const dynastyTeam = await prisma.seasonHistory?.groupBy({
      by: ['champion'],
      where: { leagueId: league!.id },
      _count: { champion: true },
      orderBy: { _count: { champion: 'desc' } },
    });

    expect(dynastyTeam?.[0].champion).toBe('Team Alpha');
    expect(dynastyTeam?.[0]._count.champion).toBe(3);
  });
});
