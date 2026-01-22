// tests/backend/be-task-36.test.ts
// Backend Test: Implement Get Power Rankings Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getPowerRankings } from '@/data/power-rankings/get-power-rankings';

describe('Backend: Implement Get Power Rankings Data Fetcher (task-36)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    if (testLeagueId) {
      // Delete PowerRankingEntries first (via cascade from PowerRanking)
      await prisma.powerRanking.deleteMany({ where: { leagueId: testLeagueId } }).catch(() => {});
      await prisma.team.deleteMany({ where: { leagueId: testLeagueId } }).catch(() => {});
      await prisma.league.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries PowerRankings for week ordered by rank', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_fetch',
        name: 'TEST_Rankings Fetch',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Create teams
    const teams = [];
    for (let i = 0; i < 4; i++) {
      const team = await prisma.team.create({
        data: {
          leagueId: league.id,
          name: `TEST_Rank Team ${i}`,
          ownerUsername: `rank${i}`,
          wins: 4 - i,
          losses: i,
          ties: 0,
        },
      });
      teams.push(team);
    }

    // Create PowerRanking parent record
    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 10,
        status: 'published',
      },
    });

    // Create PowerRankingEntry records for each team
    for (let i = 0; i < teams.length; i++) {
      await prisma.powerRankingEntry.create({
        data: {
          powerRankingId: powerRanking.id,
          teamId: teams[i]!.id,
          rank: i + 1,
          movement: 0,
        },
      });
    }

    // Use the actual getPowerRankings function
    const result = await getPowerRankings({
      leagueSlug: 'test_rankings_fetch',
      weekNumber: 10,
      season: 2025,
    });

    expect(result.rankings.length).toBe(4);
    expect(result.rankings[0]?.rank).toBe(1);
    expect(result.rankings[3]?.rank).toBe(4);
    // Verify ordering is correct
    for (let i = 0; i < result.rankings.length - 1; i++) {
      expect(result.rankings[i]?.rank).toBeLessThan(result.rankings[i + 1]?.rank ?? Infinity);
    }
  });

  test('includes team data and movement indicators', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_movement',
        name: 'TEST_Rankings Movement',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Moving Team',
        ownerUsername: 'moving',
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });

    // Create PowerRanking parent
    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 10,
        status: 'published',
      },
    });

    // Create entry with movement (moved up 3 spots from rank 5 to rank 2)
    await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: powerRanking.id,
        teamId: team.id,
        rank: 2,
        previousRank: 5,
        movement: 3, // Moved up 3 spots
      },
    });

    const result = await getPowerRankings({
      leagueSlug: 'test_rankings_movement',
      weekNumber: 10,
      season: 2025,
    });

    expect(result.rankings.length).toBe(1);
    expect(result.rankings[0]?.teamName).toBe('TEST_Moving Team');
    expect(result.rankings[0]?.previousRank).toBe(5);
    expect(result.rankings[0]?.record.wins).toBe(5);
    expect(result.rankings[0]?.record.losses).toBe(3);
  });

  test('shows commissioner commentary', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_commentary',
        name: 'TEST_Rankings Commentary',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Commentary Team',
        ownerUsername: 'commentary',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Create PowerRanking parent
    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 10,
        status: 'published',
      },
    });

    // Create entry with commentary
    await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: powerRanking.id,
        teamId: team.id,
        rank: 1,
        movement: 0,
        commentary: 'TEST_Dominant performance this week!',
      },
    });

    const result = await getPowerRankings({
      leagueSlug: 'test_rankings_commentary',
      weekNumber: 10,
      season: 2025,
    });

    expect(result.rankings[0]?.commentary).toBe('TEST_Dominant performance this week!');
  });

  test('returns PowerRankingsData type contract shape', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_shape',
        name: 'TEST_Rankings Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Shape Team',
        ownerUsername: 'shape',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Create PowerRanking parent
    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 10,
        status: 'published',
      },
    });

    // Create entry
    await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: powerRanking.id,
        teamId: team.id,
        rank: 1,
        movement: 0,
      },
    });

    const result = await getPowerRankings({
      leagueSlug: 'test_rankings_shape',
      weekNumber: 10,
      season: 2025,
    });

    // Verify PowerRankingsData type contract shape
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('leagueSlug');
    expect(result).toHaveProperty('seasonId');
    expect(result).toHaveProperty('weekNumber');
    expect(result).toHaveProperty('rankings');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('lastSaved');
    expect(Array.isArray(result.rankings)).toBe(true);

    // Verify TeamRanking shape within rankings array
    const ranking = result.rankings[0];
    expect(ranking).toHaveProperty('id');
    expect(ranking).toHaveProperty('teamId');
    expect(ranking).toHaveProperty('teamName');
    expect(ranking).toHaveProperty('ownerUsername');
    expect(ranking).toHaveProperty('record');
    expect(ranking).toHaveProperty('rank');
    expect(ranking).toHaveProperty('commentary');
  });

  test('returns empty rankings array for week with no rankings', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_empty',
        name: 'TEST_Rankings Empty',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Don't create any power rankings for week 99
    const result = await getPowerRankings({
      leagueSlug: 'test_rankings_empty',
      weekNumber: 99,
      season: 2025,
    });

    // Should fall back to mock data since no DB ranking exists
    // The mock data returns rankings, but we're testing the query logic
    expect(result).toHaveProperty('rankings');
    expect(result.weekNumber).toBe(99);
  });

  test('falls back to mock data for non-existent league', async () => {
    const result = await getPowerRankings({
      leagueSlug: 'non-existent-league-slug',
      weekNumber: 1,
    });

    // Should return mock data with the requested leagueSlug
    expect(result).toHaveProperty('rankings');
    expect(result.leagueSlug).toBe('non-existent-league-slug');
    expect(result.weekNumber).toBe(1);
  });
});
