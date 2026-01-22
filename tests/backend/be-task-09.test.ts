// tests/backend/be-task-09.test.ts
// Backend Test: Create Power Rankings Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Power Rankings Schema (task-09)', () => {
  let testLeagueId: string | null = null;
  let testTeamId: string | null = null;

  afterEach(async () => {
    // Delete PowerRankingEntry records first (child table)
    await prisma.powerRankingEntry?.deleteMany({ where: { powerRanking: { leagueId: testLeagueId || '' } } }).catch(() => {});
    // Delete PowerRanking records (parent table)
    await prisma.powerRanking?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testTeamId) {
      await prisma.team?.delete({ where: { id: testTeamId } }).catch(() => {});
      testTeamId = null;
    }
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('powerRankings table exists with required fields', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_rankings_league',
        name: 'TEST_Rankings League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Ranked Team',
        ownerUsername: 'test_owner',
        wins: 8,
        losses: 4,
        ties: 0,
      },
    });
    testTeamId = team?.id || null;

    // Create PowerRanking (parent)
    const ranking = await prisma.powerRanking?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 5,
        status: 'published',
      },
    });

    // Create PowerRankingEntry (child)
    const entry = await prisma.powerRankingEntry?.create({
      data: {
        powerRankingId: ranking!.id,
        teamId: team!.id,
        rank: 1,
        movement: 0,
        commentary: 'TEST_Dominant performance this week!',
      },
    });

    expect(ranking).toBeDefined();
    expect(entry).toBeDefined();
    if (ranking) {
      expect(ranking.id).toBeDefined();
      expect(ranking.leagueId).toBe(league!.id);
      expect(ranking.season).toBe(2025);
      expect(ranking.weekNumber).toBe(5);
      expect(ranking.status).toBe('published');
    }
    if (entry) {
      expect(entry.powerRankingId).toBe(ranking!.id);
      expect(entry.teamId).toBe(team!.id);
      expect(entry.rank).toBe(1);
      expect(entry.movement).toBe(0);
      expect(entry.commentary).toBe('TEST_Dominant performance this week!');
    }
  });

  test('enforces compound unique on (leagueId, season, weekNumber) and (powerRankingId, teamId)', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_unique_rankings',
        name: 'TEST_Unique Rankings',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Unique Ranked Team',
        ownerUsername: 'test_owner',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeamId = team?.id || null;

    // Create first PowerRanking
    const ranking = await prisma.powerRanking?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 3,
      },
    });

    // Create first entry
    await prisma.powerRankingEntry?.create({
      data: {
        powerRankingId: ranking!.id,
        teamId: team!.id,
        rank: 5,
        movement: 2,
        commentary: 'TEST_First ranking',
      },
    });

    // Test 1: Attempt duplicate PowerRanking for same league/season/week
    await expect(
      prisma.powerRanking?.create({
        data: {
          leagueId: league!.id,
          season: 2025,
          weekNumber: 3,
        },
      })
    ).rejects.toThrow(/unique/i);

    // Test 2: Attempt duplicate entry for same team in same ranking
    await expect(
      prisma.powerRankingEntry?.create({
        data: {
          powerRankingId: ranking!.id,
          teamId: team!.id,
          rank: 3,
          movement: -2,
          commentary: 'TEST_Duplicate entry',
        },
      })
    ).rejects.toThrow(/unique/i);
  });

  test('stores history for each week', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_history_rankings',
        name: 'TEST_History Rankings',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_History Team',
        ownerUsername: 'test_owner',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeamId = team?.id || null;

    // Create rankings for multiple weeks
    for (let week = 1; week <= 5; week++) {
      const ranking = await prisma.powerRanking?.create({
        data: {
          leagueId: league!.id,
          season: 2025,
          weekNumber: week,
          status: 'published',
        },
      });

      await prisma.powerRankingEntry?.create({
        data: {
          powerRankingId: ranking!.id,
          teamId: team!.id,
          rank: 6 - week, // Rank improves each week
          movement: week > 1 ? 1 : 0,
          commentary: `TEST_Week ${week} commentary`,
        },
      });
    }

    const rankings = await prisma.powerRanking?.findMany({
      where: { leagueId: league!.id },
      orderBy: { weekNumber: 'asc' },
      include: { entries: { where: { teamId: team!.id } } },
    });

    expect(rankings?.length).toBe(5);
    expect(rankings?.[0].entries[0].rank).toBe(5);
    expect(rankings?.[4].entries[0].rank).toBe(1);
  });

  test('PowerRankingsData type matches frontend expectations', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_type_rankings',
        name: 'TEST_Type Rankings',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Type Ranked Team',
        ownerUsername: 'test_owner',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeamId = team?.id || null;

    const ranking = await prisma.powerRanking?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 1,
        status: 'published',
      },
    });

    const entry = await prisma.powerRankingEntry?.create({
      data: {
        powerRankingId: ranking!.id,
        teamId: team!.id,
        rank: 3,
        movement: -1,
        commentary: 'TEST_Type contract',
      },
    });

    // Test PowerRanking properties
    expect(ranking).toHaveProperty('leagueId');
    expect(ranking).toHaveProperty('season');
    expect(ranking).toHaveProperty('weekNumber');
    expect(ranking).toHaveProperty('status');

    // Test PowerRankingEntry properties
    expect(entry).toHaveProperty('powerRankingId');
    expect(entry).toHaveProperty('teamId');
    expect(entry).toHaveProperty('rank');
    expect(entry).toHaveProperty('movement');
    expect(entry).toHaveProperty('commentary');
  });
});
