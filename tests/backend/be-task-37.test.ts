// tests/backend/be-task-37.test.ts
// Backend Test: Implement Get Power Rankings History Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getRankingsHistory } from '@/data/power-rankings/get-rankings-history';

describe('Backend: Implement Get Power Rankings History Data Fetcher (task-37)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    // Clean up in correct order respecting foreign key constraints
    if (testLeagueId) {
      // Delete power ranking entries first
      await prisma.powerRankingEntry.deleteMany({
        where: { powerRanking: { leagueId: testLeagueId } },
      }).catch(() => {});
      // Delete power rankings
      await prisma.powerRanking.deleteMany({
        where: { leagueId: testLeagueId },
      }).catch(() => {});
      // Delete teams
      await prisma.team.deleteMany({
        where: { leagueId: testLeagueId },
      }).catch(() => {});
      // Delete league
      await prisma.league.delete({
        where: { id: testLeagueId },
      }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries PowerRankings for all weeks in season', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_history',
        name: 'TEST_Rankings History',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_History Team',
        ownerUsername: 'history',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Create rankings for multiple weeks using correct schema
    for (let week = 1; week <= 5; week++) {
      const powerRanking = await prisma.powerRanking.create({
        data: {
          leagueId: league.id,
          season: 2025,
          weekNumber: week,
          status: 'published',
          entries: {
            create: {
              teamId: team.id,
              rank: 6 - week, // Improving: 5, 4, 3, 2, 1
              previousRank: week > 1 ? 7 - week : null,
              movement: week > 1 ? 1 : 0,
            },
          },
        },
      });
    }

    const allRankings = await prisma.powerRanking.findMany({
      where: { leagueId: league.id },
      orderBy: { weekNumber: 'asc' },
    });

    expect(allRankings.length).toBe(5);
    expect(allRankings[0].weekNumber).toBe(1);
    expect(allRankings[4].weekNumber).toBe(5);
  });

  test('groups by team to show rank progression', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_progression',
        name: 'TEST_Rankings Progression',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const teams = [];
    for (let i = 0; i < 2; i++) {
      const team = await prisma.team.create({
        data: {
          leagueId: league.id,
          name: `TEST_Prog Team ${i}`,
          ownerUsername: `prog${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });
      teams.push(team);
    }

    // Team 0 starts at 1, ends at 2
    // Team 1 starts at 2, ends at 1
    for (let week = 1; week <= 3; week++) {
      await prisma.powerRanking.create({
        data: {
          leagueId: league.id,
          season: 2025,
          weekNumber: week,
          status: 'published',
          entries: {
            create: [
              {
                teamId: teams[0].id,
                rank: week === 3 ? 2 : 1,
                movement: week === 3 ? -1 : 0,
              },
              {
                teamId: teams[1].id,
                rank: week === 3 ? 1 : 2,
                movement: week === 3 ? 1 : 0,
              },
            ],
          },
        },
      });
    }

    // Group rankings by team using the entry model
    const team0Rankings = await prisma.powerRankingEntry.findMany({
      where: {
        teamId: teams[0].id,
        powerRanking: { leagueId: league.id },
      },
      include: { powerRanking: true },
      orderBy: { powerRanking: { weekNumber: 'asc' } },
    });

    const team1Rankings = await prisma.powerRankingEntry.findMany({
      where: {
        teamId: teams[1].id,
        powerRanking: { leagueId: league.id },
      },
      include: { powerRanking: true },
      orderBy: { powerRanking: { weekNumber: 'asc' } },
    });

    expect(team0Rankings.map((r) => r.rank)).toEqual([1, 1, 2]);
    expect(team1Rankings.map((r) => r.rank)).toEqual([2, 2, 1]);
  });

  test('calculates total weeks ranked #1', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_first',
        name: 'TEST_Rankings First',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_First Team',
        ownerUsername: 'first',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Team was #1 for weeks 1-3, then dropped
    for (let week = 1; week <= 5; week++) {
      await prisma.powerRanking.create({
        data: {
          leagueId: league.id,
          season: 2025,
          weekNumber: week,
          status: 'published',
          entries: {
            create: {
              teamId: team.id,
              rank: week <= 3 ? 1 : 2,
              movement: 0,
            },
          },
        },
      });
    }

    const weeksAtFirst = await prisma.powerRankingEntry.count({
      where: {
        teamId: team.id,
        rank: 1,
        powerRanking: { leagueId: league.id },
      },
    });

    expect(weeksAtFirst).toBe(3);
  });

  test('returns RankingsHistoryData type contract shape', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_rankings_history_shape',
        name: 'TEST_Rankings History Shape',
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

    await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 1,
        status: 'published',
        entries: {
          create: {
            teamId: team.id,
            rank: 1,
            movement: 0,
          },
        },
      },
    });

    // Use the actual getRankingsHistory function
    const historyData = await getRankingsHistory({ leagueSlug: league.slug });

    // Verify RankingsHistoryData shape
    expect(historyData).toHaveProperty('leagueSlug');
    expect(historyData).toHaveProperty('seasonId');
    expect(historyData).toHaveProperty('history');
    expect(historyData).toHaveProperty('totalWeeks');
    expect(Array.isArray(historyData.history)).toBe(true);

    if (historyData.history.length > 0) {
      const teamHistory = historyData.history[0];
      expect(teamHistory).toHaveProperty('teamId');
      expect(teamHistory).toHaveProperty('teamName');
      expect(teamHistory).toHaveProperty('color');
      expect(teamHistory).toHaveProperty('history');
      expect(Array.isArray(teamHistory.history)).toBe(true);

      if (teamHistory.history.length > 0) {
        expect(teamHistory.history[0]).toHaveProperty('week');
        expect(teamHistory.history[0]).toHaveProperty('rank');
      }
    }
  });

  test('getRankingsHistory returns correct data structure', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_history_full',
        name: 'TEST_History Full',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team1 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Team Alpha',
        ownerUsername: 'alpha',
        wins: 5,
        losses: 2,
        ties: 0,
      },
    });

    const team2 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Team Beta',
        ownerUsername: 'beta',
        wins: 4,
        losses: 3,
        ties: 0,
      },
    });

    // Create 3 weeks of rankings
    for (let week = 1; week <= 3; week++) {
      await prisma.powerRanking.create({
        data: {
          leagueId: league.id,
          season: 2025,
          weekNumber: week,
          status: 'published',
          entries: {
            create: [
              {
                teamId: team1.id,
                rank: week === 2 ? 2 : 1, // Team 1 drops to 2nd in week 2
                movement: week === 2 ? -1 : (week === 3 ? 1 : 0),
              },
              {
                teamId: team2.id,
                rank: week === 2 ? 1 : 2, // Team 2 rises to 1st in week 2
                movement: week === 2 ? 1 : (week === 3 ? -1 : 0),
              },
            ],
          },
        },
      });
    }

    const historyData = await getRankingsHistory({ leagueSlug: league.slug });

    expect(historyData.leagueSlug).toBe(league.slug);
    expect(historyData.seasonId).toBe('season-2025');
    expect(historyData.totalWeeks).toBe(3);
    expect(historyData.history.length).toBe(2);

    // Check team histories
    const team1History = historyData.history.find(h => h.teamId === team1.id);
    const team2History = historyData.history.find(h => h.teamId === team2.id);

    expect(team1History).toBeDefined();
    expect(team1History!.teamName).toBe('TEST_Team Alpha');
    expect(team1History!.history.map(h => h.rank)).toEqual([1, 2, 1]);

    expect(team2History).toBeDefined();
    expect(team2History!.teamName).toBe('TEST_Team Beta');
    expect(team2History!.history.map(h => h.rank)).toEqual([2, 1, 2]);
  });

  test('only includes published rankings in history', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_history_published_only',
        name: 'TEST_History Published Only',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Published Team',
        ownerUsername: 'published',
        wins: 3,
        losses: 4,
        ties: 0,
      },
    });

    // Create published rankings for weeks 1-2
    for (let week = 1; week <= 2; week++) {
      await prisma.powerRanking.create({
        data: {
          leagueId: league.id,
          season: 2025,
          weekNumber: week,
          status: 'published',
          entries: {
            create: {
              teamId: team.id,
              rank: 1,
              movement: 0,
            },
          },
        },
      });
    }

    // Create a draft ranking for week 3 (should not appear)
    await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 3,
        status: 'draft',
        entries: {
          create: {
            teamId: team.id,
            rank: 2,
            movement: -1,
          },
        },
      },
    });

    const historyData = await getRankingsHistory({ leagueSlug: league.slug });

    // Should only include weeks 1 and 2
    expect(historyData.totalWeeks).toBe(2);
    const teamHistory = historyData.history.find(h => h.teamId === team.id);
    expect(teamHistory!.history.length).toBe(2);
    expect(teamHistory!.history.map(h => h.week)).toEqual([1, 2]);
  });
});
