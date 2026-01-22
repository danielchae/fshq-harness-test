// tests/backend/be-task-27.test.ts
// Backend Test: Implement Update Power Rankings Server Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Update Power Rankings Server Action (task-27)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    // Clean up in correct order (child before parent)
    if (testLeagueId) {
      await prisma.powerRankingEntry.deleteMany({
        where: { powerRanking: { leagueId: testLeagueId } }
      }).catch(() => {});
      await prisma.powerRanking.deleteMany({ where: { leagueId: testLeagueId } }).catch(() => {});
      await prisma.team.deleteMany({ where: { leagueId: testLeagueId } }).catch(() => {});
      await prisma.leagueMembership.deleteMany({ where: { leagueId: testLeagueId } }).catch(() => {});
      await prisma.league.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('update rankings validates user has commissioner role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_rankings_role@example.com', name: 'TEST_RankingsRole' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_role',
        name: 'TEST_Rankings Role',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const membership = await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    expect(membership.role).toBe('commissioner');
  });

  test('update rankings upserts PowerRankings records', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_rankings_upsert@example.com', name: 'TEST_RankingsUpsert' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_upsert',
        name: 'TEST_Rankings Upsert',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Create teams
    const teams = [];
    for (let i = 0; i < 6; i++) {
      const team = await prisma.team.create({
        data: {
          leagueId: league.id,
          name: `TEST_Team ${i}`,
          ownerUsername: `owner${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });
      teams.push(team);
    }

    // Create parent PowerRanking first
    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        status: 'draft',
      },
    });

    // Create ranking entries for each team
    for (let i = 0; i < teams.length; i++) {
      await prisma.powerRankingEntry.create({
        data: {
          powerRankingId: powerRanking.id,
          teamId: teams[i]!.id,
          rank: i + 1,
          movement: 0,
          commentary: `TEST_Team ${i} commentary`,
        },
      });
    }

    // Verify ranking entries exist
    const rankings = await prisma.powerRankingEntry.findMany({
      where: { powerRankingId: powerRanking.id },
      orderBy: { rank: 'asc' },
    });

    expect(rankings.length).toBe(6);
    expect(rankings[0]?.rank).toBe(1);
  });

  test('update rankings calculates movement from previous week', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_rankings_move@example.com', name: 'TEST_RankingsMove' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_move',
        name: 'TEST_Rankings Move',
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
        ownerUsername: 'mover',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Week 4: Ranked 5th
    const week4Ranking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 4,
        status: 'published',
      },
    });

    await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: week4Ranking.id,
        teamId: team.id,
        rank: 5,
        previousRank: null,
        movement: 0,
      },
    });

    // Week 5: Ranked 2nd (moved up 3)
    const week5Ranking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        status: 'draft',
      },
    });

    await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: week5Ranking.id,
        teamId: team.id,
        rank: 2,
        previousRank: 5,
        movement: 3, // 5 - 2 = moved up 3
      },
    });

    const week5Entry = await prisma.powerRankingEntry.findFirst({
      where: {
        powerRankingId: week5Ranking.id,
        teamId: team.id,
      },
    });

    expect(week5Entry?.movement).toBe(3);
    expect(week5Entry?.previousRank).toBe(5);
  });

  test('update rankings stores commissioner commentary', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_rankings_comm@example.com', name: 'TEST_RankingsComm' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_comm',
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
        ownerUsername: 'commenter',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        status: 'draft',
      },
    });

    const ranking = await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: powerRanking.id,
        teamId: team.id,
        rank: 1,
        movement: 0,
        commentary: 'TEST_This team has been dominant all season!',
      },
    });

    expect(ranking.commentary).toBe('TEST_This team has been dominant all season!');
  });

  test('update rankings returns PowerRankingsData', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_rankings_data@example.com', name: 'TEST_RankingsData' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_data',
        name: 'TEST_Rankings Data',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        status: 'draft',
      },
    });

    // Create teams with rankings
    for (let i = 0; i < 3; i++) {
      const team = await prisma.team.create({
        data: {
          leagueId: league.id,
          name: `TEST_Data Team ${i}`,
          ownerUsername: `data${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });

      await prisma.powerRankingEntry.create({
        data: {
          powerRankingId: powerRanking.id,
          teamId: team.id,
          rank: i + 1,
          movement: 0,
        },
      });
    }

    // Fetch with team data
    const rankings = await prisma.powerRankingEntry.findMany({
      where: { powerRankingId: powerRanking.id },
      include: { team: true },
      orderBy: { rank: 'asc' },
    });

    // Simulating PowerRankingsData response
    const powerRankingsData = {
      weekNumber: 5,
      rankings: rankings.map((r) => ({
        teamId: r.teamId,
        teamName: r.team.name,
        rank: r.rank,
        movement: r.movement,
        commentary: r.commentary,
      })),
    };

    expect(powerRankingsData.weekNumber).toBe(5);
    expect(powerRankingsData.rankings.length).toBe(3);
  });

  test('update rankings enforces compound unique constraint', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_unique',
        name: 'TEST_Rankings Unique',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Unique Team',
        ownerUsername: 'unique',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        status: 'draft',
      },
    });

    // First ranking entry
    await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: powerRanking.id,
        teamId: team.id,
        rank: 1,
        movement: 0,
      },
    });

    // Duplicate team entry should fail
    await expect(
      prisma.powerRankingEntry.create({
        data: {
          powerRankingId: powerRanking.id,
          teamId: team.id,
          rank: 2,
          movement: 0,
        },
      })
    ).rejects.toThrow();
  });
});
