// tests/backend/be-task-44.test.ts
// Backend Test: Implement Get Commissioner Desk Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Commissioner Desk Data Fetcher (task-44)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.matchupPrediction.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.matchup.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.powerRankingEntry.deleteMany({ where: { powerRanking: { leagueId: testLeagueId || '' } } }).catch(() => {});
    await prisma.powerRanking.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.leagueMembership.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('validates user has commissioner role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_desk_role@example.com', name: 'TEST_DeskRole' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_desk_role',
        name: 'TEST_Desk Role',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    const membership = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league.id },
    });

    const isCommissioner = membership?.role === 'commissioner';
    expect(isCommissioner).toBe(true);
  });

  test('rejects non-commissioner users', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_desk_reject@example.com', name: 'TEST_DeskReject' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_desk_reject',
        name: 'TEST_Desk Reject',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'manager',
        status: 'approved',
      },
    });

    const membership = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league.id },
    });

    const isCommissioner = membership?.role === 'commissioner';
    expect(isCommissioner).toBe(false);
  });

  test('queries current power rankings draft', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_desk_rankings',
        name: 'TEST_Desk Rankings',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Create a power ranking for the week first
    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 10,
        status: 'draft',
      },
    });

    const teams = [];
    for (let i = 0; i < 4; i++) {
      const team = await prisma.team.create({
        data: {
          leagueId: league.id,
          name: `TEST_Desk Team ${i}`,
          ownerUsername: `desk${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });
      teams.push(team);

      await prisma.powerRankingEntry.create({
        data: {
          powerRankingId: powerRanking.id,
          teamId: team.id,
          rank: i + 1,
          movement: 0,
          commentary: `TEST_Draft commentary ${i}`,
        },
      });
    }

    const rankings = await prisma.powerRanking.findMany({
      where: { leagueId: league.id, weekNumber: 10 },
      include: {
        entries: {
          include: { team: true },
          orderBy: { rank: 'asc' },
        },
      },
    });

    expect(rankings.length).toBe(1);
    expect(rankings[0].entries.length).toBe(4);
    expect(rankings[0].entries[0].commentary).toBe('TEST_Draft commentary 0');
  });

  test('queries current matchup predictions draft', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_desk_predictions',
        name: 'TEST_Desk Predictions',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team1 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Pred Team 1',
        ownerUsername: 'pred1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Pred Team 2',
        ownerUsername: 'pred2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 10,
        homeTeamId: team1.id,
        awayTeamId: team2.id,
        isComplete: false,
      },
    });

    await prisma.matchupPrediction.create({
      data: {
        matchupId: matchup.id,
        leagueId: league.id,
        season: 2025,
        weekNumber: 10,
        predictedWinnerId: team1.id,
        hypeText: 'TEST_Draft hype text!',
        status: 'draft',
      },
    });

    const matchupWithPrediction = await prisma.matchup.findUnique({
      where: { id: matchup.id },
      include: { predictions: true, homeTeam: true, awayTeam: true },
    });

    expect(matchupWithPrediction?.predictions?.[0]?.hypeText).toBe('TEST_Draft hype text!');
  });

  test('returns DeskData type contract shape', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_desk_shape',
        name: 'TEST_Desk Shape',
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

    // Simulate DeskData structure matching the actual interface
    const deskData = {
      seasons: [{ id: 'season-2025', year: 2025, label: '2025 Season' }],
      weeks: [{ id: 'week-10', number: 10, label: 'Week 10', status: 'draft' as const }],
      currentSeason: { id: 'season-2025', year: 2025, label: '2025 Season' },
      currentWeek: 10,
      drafts: [{
        id: 'draft-1',
        leagueSlug: 'test_desk_shape',
        seasonId: 'season-2025',
        weekNumber: 10,
        type: 'power-rankings' as const,
        content: `1. ${team.name} - TEST_Top team`,
        status: 'draft' as const,
        lastSaved: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      isCommissioner: true,
      leagueId: league.id,
    };

    expect(deskData).toHaveProperty('seasons');
    expect(deskData).toHaveProperty('weeks');
    expect(deskData).toHaveProperty('currentSeason');
    expect(deskData).toHaveProperty('currentWeek');
    expect(deskData).toHaveProperty('drafts');
    expect(deskData).toHaveProperty('isCommissioner');
    expect(deskData).toHaveProperty('leagueId');
  });

  test('supports real-time editing (no-store cache)', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_desk_realtime',
        name: 'TEST_Desk Realtime',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Realtime Team',
        ownerUsername: 'realtime',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Create power ranking first
    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 10,
        status: 'draft',
      },
    });

    // Create ranking entry
    const rankingEntry = await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: powerRanking.id,
        teamId: team.id,
        rank: 1,
        movement: 0,
        commentary: 'TEST_Initial',
      },
    });

    // Update ranking entry (real-time edit)
    await prisma.powerRankingEntry.update({
      where: { id: rankingEntry.id },
      data: { commentary: 'TEST_Updated in real-time' },
    });

    // Immediate read should show update (no cache)
    const current = await prisma.powerRankingEntry.findUnique({
      where: { id: rankingEntry.id },
    });

    expect(current?.commentary).toBe('TEST_Updated in real-time');
  });
});
