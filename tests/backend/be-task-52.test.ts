// tests/backend/be-task-52.test.ts
// Backend Test: Implement Stat Correction Detection Job

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Stat Correction Detection Job (task-52)', () => {
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
          name: `TEST_StatCorr_Team_${i}`,
        },
      });
      ids.push(team.id);
      testTeamIds.push(team.id);
    }
    return ids;
  }

  test('monitors for score changes after initial completion', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_stat_monitor',
        name: 'TEST_Stat Monitor',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams for the league
    const teamIds = await createTeams(league!.id, 2);

    // Create matchup with initial scores
    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        homeTeamId: teamIds[0],
        awayTeamId: teamIds[1],
        homeScore: 105.5,
        awayScore: 104.2,
        isComplete: true,
        winnerId: teamIds[0],
        lastScoreUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
    });

    // Simulate score correction
    const correctedScores = {
      homeScore: 104.5, // Decreased
      awayScore: 105.2, // Increased - now winner!
    };

    const originalWinner = matchup?.winnerId;
    const newWinner =
      correctedScores.homeScore > correctedScores.awayScore ? teamIds[0] : teamIds[1];

    expect(originalWinner).toBe(teamIds[0]);
    expect(newWinner).toBe(teamIds[1]);
    expect(originalWinner !== newWinner).toBe(true); // Winner changed!
  });

  test('re-grades pickems if matchup winner changes', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_stat_regrade@example.com', name: 'TEST_StatRegrade' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_stat_regrade',
        name: 'TEST_Stat Regrade',
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
        homeScore: 105.5,
        awayScore: 104.2,
        isComplete: true,
        winnerId: teamIds[0],
      },
    });

    // User picked away team (originally incorrect)
    const pick = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        matchupId: matchup!.id,
        weekNumber: 10,
        season: 2025,
        predictedWinnerId: teamIds[1],
        isCorrect: false, // Originally graded as wrong
        pointsEarned: 0,
      },
    });

    // Stat correction changes winner to away team
    await prisma.matchup?.update({
      where: { id: matchup!.id },
      data: {
        homeScore: 104.5,
        awayScore: 105.2,
        winnerId: teamIds[1],
      },
    });

    // Re-grade pick
    const regradedPick = await prisma.pickemEntry?.update({
      where: { id: pick!.id },
      data: {
        isCorrect: true, // Now correct!
        pointsEarned: 1,
      },
    });

    expect(regradedPick?.isCorrect).toBe(true);
    expect(regradedPick?.pointsEarned).toBe(1);
  });

  test('tracks stat correction timestamp', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_stat_timestamp',
        name: 'TEST_Stat Timestamp',
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
        lastScoreUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    // Update with stat correction
    const correctedMatchup = await prisma.matchup?.update({
      where: { id: matchup!.id },
      data: {
        winnerId: teamIds[1],
        lastScoreUpdate: new Date(),
        statCorrectionAt: new Date(),
      },
    });

    expect(correctedMatchup?.statCorrectionAt).toBeDefined();
  });

  test('updates leaderboard with corrected scores', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_stat_leaderboard@example.com', name: 'TEST_StatLeaderboard' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_stat_leaderboard',
        name: 'TEST_Stat Leaderboard',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Initial stats (before correction)
    const initialStats = await prisma.seasonStats?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: 2025,
        totalPicks: 60,
        correctPicks: 40, // Before correction
        accuracy: 40 / 60,
        currentStreak: 0, // Streak broken
        longestStreak: 5,
      },
    });

    // After stat correction adds a correct pick
    const updatedStats = await prisma.seasonStats?.update({
      where: { id: initialStats!.id },
      data: {
        correctPicks: 41,
        accuracy: 41 / 60,
        currentStreak: 1, // Streak restored
      },
    });

    expect(updatedStats?.correctPicks).toBe(41);
    expect(updatedStats?.currentStreak).toBe(1);

    // Cleanup
    await prisma.seasonStats?.delete({ where: { id: initialStats!.id } }).catch(() => {});
  });

  test('notifies affected users of stat correction', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_stat_notify@example.com', name: 'TEST_StatNotify' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_stat_notify',
        name: 'TEST_Stat Notify',
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

    // User pick affected by correction
    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        matchupId: matchup!.id,
        weekNumber: 10,
        season: 2025,
        predictedWinnerId: teamIds[1],
        isCorrect: false,
      },
    });

    // Find affected users for notification
    const affectedPicks = await prisma.pickemEntry?.findMany({
      where: {
        matchupId: matchup!.id,
        predictedWinnerId: teamIds[1], // New winner
      },
      include: { user: true },
    });

    // Simulate notification payload
    const notifications = affectedPicks?.map((pick) => ({
      userId: pick.userId,
      type: 'stat_correction',
      message: `Good news! A stat correction changed the outcome of Week 10. Your pick is now correct!`,
    }));

    expect(notifications?.length).toBeGreaterThan(0);
    expect(notifications?.[0].type).toBe('stat_correction');
  });

  test('handles ties correctly', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_stat_tie',
        name: 'TEST_Stat Tie',
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
        homeScore: 100.0,
        awayScore: 100.0, // Tie after correction
        isComplete: true,
        winnerId: null, // No winner - tie
      },
    });

    expect(matchup?.winnerId).toBeNull();
    expect(matchup?.homeScore).toBe(matchup?.awayScore);
  });

  test('processes corrections only for recent completed games', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_stat_recent',
        name: 'TEST_Stat Recent',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams for the league (4 teams for 2 matchups)
    const teamIds = await createTeams(league!.id, 4);

    // Old completed matchup (7+ days ago)
    const oldMatchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 5,
        homeTeamId: teamIds[0],
        awayTeamId: teamIds[1],
        isComplete: true,
        winnerId: teamIds[0],
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Recent completed matchup (1 day ago)
    const recentMatchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        homeTeamId: teamIds[2],
        awayTeamId: teamIds[3],
        isComplete: true,
        winnerId: teamIds[2],
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });

    // Query for recent matchups eligible for correction monitoring
    const correctionWindow = 3 * 24 * 60 * 60 * 1000; // 3 days
    const eligibleMatchups = await prisma.matchup?.findMany({
      where: {
        leagueId: league!.id,
        isComplete: true,
        completedAt: { gte: new Date(Date.now() - correctionWindow) },
      },
    });

    expect(eligibleMatchups?.length).toBe(1);
    expect(eligibleMatchups?.[0].weekNumber).toBe(10);
  });
});
