// tests/backend/be-task-11.test.ts
// Backend Test: Create Pick'ems Entries and Grading Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Pick\'ems Entries and Grading Schema (task-11)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  let testMatchupId: string | null = null;

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
    testMatchupId = null;
  });

  test('pickemEntries table exists with required fields', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pickem_user@example.com', name: 'TEST_PickemUser' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_pickems_league',
        name: 'TEST_Pickems League',
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
        weekNumber: 5,
        season: 2025,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });
    testMatchupId = matchup?.id || null;

    const entry = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    expect(entry).toBeDefined();
    if (entry) {
      expect(entry.id).toBeDefined();
      expect(entry.userId).toBe(user.id);
      expect(entry.leagueId).toBe(league!.id);
      expect(entry.weekNumber).toBe(5);
      expect(entry.matchupId).toBe(matchup!.id);
      expect(entry.predictedWinnerId).toBe(team1!.id);
    }
  });

  test('enforces compound unique on (userId, matchupId)', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_unique_pick@example.com', name: 'TEST_UniquePick' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_unique_pickems',
        name: 'TEST_Unique Pickems',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Unique Team 1',
        ownerUsername: 'unique1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Unique Team 2',
        ownerUsername: 'unique2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 3,
        season: 2025,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });
    testMatchupId = matchup?.id || null;

    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 3,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    // Attempt duplicate pick
    await expect(
      prisma.pickemEntry?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          weekNumber: 3,
          season: 2025,
          matchupId: matchup!.id,
          predictedWinnerId: team2!.id,
        },
      })
    ).rejects.toThrow(/unique/i);
  });

  test('supports isCorrect and pointsEarned fields for grading', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_graded_pick@example.com', name: 'TEST_GradedPick' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_graded_pickems',
        name: 'TEST_Graded Pickems',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Graded Team 1',
        ownerUsername: 'graded1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Graded Team 2',
        ownerUsername: 'graded2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 4,
        season: 2025,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: true,
        winnerId: team1!.id,
      },
    });
    testMatchupId = matchup?.id || null;

    const entry = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 4,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
        isCorrect: true,
        pointsEarned: 1,
      },
    });

    expect(entry?.isCorrect).toBe(true);
    expect(entry?.pointsEarned).toBe(1);
  });

  test('PickemsResponse type matches frontend expectations', async () => {
    // Frontend expects PickemsResponse structure
    const user = await prisma.user.create({
      data: { email: 'TEST_type_pick@example.com', name: 'TEST_TypePick' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_type_pickems',
        name: 'TEST_Type Pickems',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Type Team 1',
        ownerUsername: 'type1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Type Team 2',
        ownerUsername: 'type2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 1,
        season: 2025,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });
    testMatchupId = matchup?.id || null;

    const entry = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 1,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    expect(entry).toHaveProperty('userId');
    expect(entry).toHaveProperty('leagueId');
    expect(entry).toHaveProperty('weekNumber');
    expect(entry).toHaveProperty('matchupId');
    expect(entry).toHaveProperty('predictedWinnerId');
  });
});
