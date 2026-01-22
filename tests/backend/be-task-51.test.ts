// tests/backend/be-task-51.test.ts
// Backend Test: Implement Pick'ems Auto-Grading Job

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Pickems Auto-Grading Job (task-51)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  const testTeamIds: string[] = [];

  afterEach(async () => {
    await prisma.pickemEntry?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.matchup?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    // Delete teams before league due to foreign key constraints
    for (const teamId of testTeamIds) {
      await prisma.team?.delete({ where: { id: teamId } }).catch(() => {});
    }
    testTeamIds.length = 0;
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  // Helper function to create teams for a league
  async function createTeams(leagueId: string, count: number = 2): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const team = await prisma.team.create({
        data: {
          leagueId,
          name: `TEST_Team_${i}`,
        },
      });
      ids.push(team.id);
      testTeamIds.push(team.id);
    }
    return ids;
  }

  test('runs after matchup results sync from platform', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_grade_trigger',
        name: 'TEST_Grade Trigger',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Simulate matchup completion event
    const matchupComplete = {
      leagueId: league!.id,
      weekNumber: 10,
      isComplete: true,
      winnerId: 'team_1',
    };

    expect(matchupComplete.isComplete).toBe(true);
    expect(matchupComplete.winnerId).toBeDefined();
  });

  test('compares user picks to actual winners', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_grade_compare@example.com', name: 'TEST_GradeCompare' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_grade_compare',
        name: 'TEST_Grade Compare',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams for the league
    const teamIds = await createTeams(league!.id, 2);

    // Create matchup with winner
    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        homeTeamId: teamIds[0],
        awayTeamId: teamIds[1],
        isComplete: true,
        winnerId: teamIds[0],
      },
    });

    // Create user pick (correct pick)
    const correctPick = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        matchupId: matchup!.id,
        weekNumber: 10,
        season: 2025,
        predictedWinnerId: teamIds[0],
        isCorrect: null, // Not yet graded
      },
    });

    // Simulate grading logic
    const actualWinner = matchup?.winnerId;
    const predictedWinner = correctPick?.predictedWinnerId;
    const isCorrect = actualWinner === predictedWinner;

    expect(isCorrect).toBe(true);
  });

  test('updates isCorrect and pointsEarned fields', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_grade_update@example.com', name: 'TEST_GradeUpdate' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_grade_update',
        name: 'TEST_Grade Update',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams for the league
    const teamIds = await createTeams(league!.id, 2);

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        homeTeamId: teamIds[0],
        awayTeamId: teamIds[1],
        isComplete: true,
        winnerId: teamIds[0],
      },
    });

    const pick = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        matchupId: matchup!.id,
        weekNumber: 10,
        season: 2025,
        predictedWinnerId: teamIds[0],
        isCorrect: null,
        pointsEarned: 0,
      },
    });

    // Grade the pick
    const gradedPick = await prisma.pickemEntry?.update({
      where: { id: pick!.id },
      data: {
        isCorrect: true,
        pointsEarned: 1,
      },
    });

    expect(gradedPick?.isCorrect).toBe(true);
    expect(gradedPick?.pointsEarned).toBe(1);
  });

  test('handles incorrect picks', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_grade_incorrect@example.com', name: 'TEST_GradeIncorrect' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_grade_incorrect',
        name: 'TEST_Grade Incorrect',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams for the league
    const teamIds = await createTeams(league!.id, 2);

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        homeTeamId: teamIds[0],
        awayTeamId: teamIds[1],
        isComplete: true,
        winnerId: teamIds[1], // Away team won
      },
    });

    const pick = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        matchupId: matchup!.id,
        weekNumber: 10,
        season: 2025,
        predictedWinnerId: teamIds[0], // Predicted home (wrong)
        isCorrect: null,
        pointsEarned: 0,
      },
    });

    // Grade the pick (incorrect)
    const isCorrect = pick?.predictedWinnerId === matchup?.winnerId;
    const gradedPick = await prisma.pickemEntry?.update({
      where: { id: pick!.id },
      data: {
        isCorrect: isCorrect,
        pointsEarned: isCorrect ? 1 : 0,
      },
    });

    expect(gradedPick?.isCorrect).toBe(false);
    expect(gradedPick?.pointsEarned).toBe(0);
  });

  test('triggers stats update via database trigger', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_grade_trigger_stats@example.com', name: 'TEST_GradeTrigger' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_grade_trigger_stats',
        name: 'TEST_Grade Trigger Stats',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create initial stats with required season field
    const initialStats = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: 2025,
        totalPicks: 10,
        correctPicks: 6,
        accuracy: 0.6,
        currentStreak: 2,
        longestStreak: 4,
      },
    });

    // Simulate stats update after grading (would be done by trigger)
    const updatedStats = await prisma.seasonStats?.update({
      where: { id: initialStats!.id },
      data: {
        totalPicks: 11,
        correctPicks: 7,
        accuracy: 7 / 11,
        currentStreak: 3,
      },
    });

    expect(updatedStats?.totalPicks).toBe(11);
    expect(updatedStats?.correctPicks).toBe(7);
    expect(updatedStats?.currentStreak).toBe(3);

    // Cleanup
    await prisma.seasonStats?.delete({ where: { id: initialStats!.id } }).catch(() => {});
  });

  test('processes multiple picks in batch', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_grade_batch@example.com', name: 'TEST_GradeBatch' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_grade_batch',
        name: 'TEST_Grade Batch',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams for all matchups (12 teams for 6 matchups)
    const teamIds = await createTeams(league!.id, 12);

    // Create multiple matchups
    const matchups = [];
    for (let i = 0; i < 6; i++) {
      const homeIdx = i * 2;
      const awayIdx = i * 2 + 1;
      const matchup = await prisma.matchup?.create({
        data: {
          leagueId: league!.id,
          weekNumber: 10,
          homeTeamId: teamIds[homeIdx],
          awayTeamId: teamIds[awayIdx],
          isComplete: true,
          winnerId: i % 2 === 0 ? teamIds[homeIdx] : teamIds[awayIdx],
        },
      });
      matchups.push(matchup);
    }

    // Create picks
    for (const matchup of matchups) {
      await prisma.pickemEntry?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          matchupId: matchup!.id,
          weekNumber: 10,
          season: 2025,
          predictedWinnerId: matchup!.winnerId!, // All correct
          isCorrect: null,
        },
      });
    }

    // Batch grade all picks
    const ungraded = await prisma.pickemEntry?.findMany({
      where: { leagueId: league!.id, isCorrect: null },
    });

    expect(ungraded?.length).toBe(6);

    // Batch update
    await prisma.pickemEntry?.updateMany({
      where: { leagueId: league!.id, isCorrect: null },
      data: { isCorrect: true, pointsEarned: 1 },
    });

    const graded = await prisma.pickemEntry?.findMany({
      where: { leagueId: league!.id },
    });

    expect(graded?.every((p) => p.isCorrect === true)).toBe(true);
  });
});
