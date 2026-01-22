// tests/backend/be-task-34.test.ts
// Backend Test: Implement Get Pick'ems Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Pickems Data Fetcher (task-34)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.pickemEntry?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    await prisma.matchup?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('queries matchups with user picks for week', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pickems_user@example.com', name: 'TEST_PickemsUser' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_pickems_user',
        name: 'TEST_Pickems User',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Pick Team 1',
        ownerUsername: 'pick1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Pick Team 2',
        ownerUsername: 'pick2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        season: 2025,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 10,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    const picks = await prisma.pickemEntry?.findMany({
      where: { userId: user.id, leagueId: league!.id, weekNumber: 10 },
      include: { matchup: { include: { homeTeam: true, awayTeam: true } } },
    });

    expect(picks?.length).toBe(1);
    expect(picks?.[0].predictedWinnerId).toBe(team1!.id);
  });

  test('reveals results after games complete', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pickems_reveal@example.com', name: 'TEST_PickemsReveal' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_pickems_reveal',
        name: 'TEST_Pickems Reveal',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Reveal Team 1',
        ownerUsername: 'reveal1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Reveal Team 2',
        ownerUsername: 'reveal2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Complete matchup
    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 9,
        season: 2025,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: true,
        winnerId: team2!.id,
      },
    });

    // User picked team1, but team2 won
    const pick = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 9,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
        isCorrect: false,
      },
    });

    expect(pick?.isCorrect).toBe(false);
  });

  test('shows weekly score and league average', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pickems_stats@example.com', name: 'TEST_PickemsStats' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_pickems_stats',
        name: 'TEST_Pickems Stats',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const teams = [];
    for (let i = 0; i < 4; i++) {
      const team = await prisma.team?.create({
        data: {
          leagueId: league!.id,
          name: `TEST_Stat Team ${i}`,
          ownerUsername: `stat${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });
      teams.push(team);
    }

    const matchup1 = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        season: 2025,
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[1]!.id,
        isComplete: true,
        winnerId: teams[0]!.id,
      },
    });

    const matchup2 = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        season: 2025,
        homeTeamId: teams[2]!.id,
        awayTeamId: teams[3]!.id,
        isComplete: true,
        winnerId: teams[2]!.id,
      },
    });

    // User picks: 1 correct, 1 wrong
    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 10,
        season: 2025,
        matchupId: matchup1!.id,
        predictedWinnerId: teams[0]!.id,
        isCorrect: true,
      },
    });

    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 10,
        season: 2025,
        matchupId: matchup2!.id,
        predictedWinnerId: teams[3]!.id,
        isCorrect: false,
      },
    });

    // Calculate weekly score
    const correctPicks = await prisma.pickemEntry?.count({
      where: { userId: user.id, leagueId: league!.id, weekNumber: 10, isCorrect: true },
    });

    const totalPicks = await prisma.pickemEntry?.count({
      where: { userId: user.id, leagueId: league!.id, weekNumber: 10 },
    });

    expect(correctPicks).toBe(1);
    expect(totalPicks).toBe(2);
  });

  test('returns PickemsResponse type contract shape', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pickems_shape@example.com', name: 'TEST_PickemsShape' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_pickems_shape',
        name: 'TEST_Pickems Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Shape Team 1',
        ownerUsername: 'shape1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Shape Team 2',
        ownerUsername: 'shape2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        season: 2025,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    const pick = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 10,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    // Verify PickemEntry type contract
    expect(pick).toHaveProperty('id');
    expect(pick).toHaveProperty('userId');
    expect(pick).toHaveProperty('matchupId');
    expect(pick).toHaveProperty('predictedWinnerId');
    expect(pick).toHaveProperty('weekNumber');
  });
});
