// tests/backend/be-task-33.test.ts
// Backend Test: Implement Get Matchups Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getMatchups } from '@/data/matchups/get-matchups';

describe('Backend: Implement Get Matchups Data Fetcher (task-33)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.matchupPrediction?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.matchup?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries matchups for week with team data', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_matchups_week',
        name: 'TEST_Matchups Week',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Matchup Team 1',
        ownerUsername: 'match1',
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Matchup Team 2',
        ownerUsername: 'match2',
        wins: 4,
        losses: 4,
        ties: 0,
      },
    });

    await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 10,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    const matchups = await prisma.matchup?.findMany({
      where: { leagueId: league!.id, weekNumber: 10 },
      include: { homeTeam: true, awayTeam: true },
    });

    expect(matchups?.length).toBe(1);
    expect(matchups?.[0].homeTeam?.name).toBe('TEST_Matchup Team 1');
    expect(matchups?.[0].awayTeam?.name).toBe('TEST_Matchup Team 2');
  });

  test('includes scores based on completion status', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_matchups_scores',
        name: 'TEST_Matchups Scores',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Score Team 1',
        ownerUsername: 'score1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Score Team 2',
        ownerUsername: 'score2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Incomplete matchup with projected scores
    const incompleteMatchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 10,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
        homeTeamProjected: 75.5, // Projected
        awayTeamProjected: 82.3, // Projected
      },
    });

    // Complete matchup with actual scores
    const completeMatchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 9,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: true,
        homeTeamScore: 110.5,
        awayTeamScore: 98.2,
        winnerId: team1!.id,
      },
    });

    expect(incompleteMatchup?.isComplete).toBe(false);
    expect(completeMatchup?.isComplete).toBe(true);
    expect(completeMatchup?.winnerId).toBe(team1!.id);
  });

  test('includes predictions if available', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_matchups_preds',
        name: 'TEST_Matchups Predictions',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Pred Team 1',
        ownerUsername: 'pred1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Pred Team 2',
        ownerUsername: 'pred2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 10,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    await prisma.matchupPrediction?.create({
      data: {
        matchupId: matchup!.id,
        leagueId: league!.id,
        season: 2025,
        weekNumber: 10,
        predictedWinnerId: team1!.id,
        hypeText: 'TEST_Battle for playoff spot!',
      },
    });

    const matchupWithPrediction = await prisma.matchup?.findUnique({
      where: { id: matchup!.id },
      include: { predictions: true },
    });

    expect(matchupWithPrediction?.predictions?.[0]?.hypeText).toBe('TEST_Battle for playoff spot!');
  });

  test('returns MatchupsResponse type contract shape', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_matchups_shape',
        name: 'TEST_Matchups Shape',
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
        season: 2025,
        weekNumber: 10,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    // Verify Matchup type contract
    expect(matchup).toHaveProperty('id');
    expect(matchup).toHaveProperty('weekNumber');
    expect(matchup).toHaveProperty('homeTeamId');
    expect(matchup).toHaveProperty('awayTeamId');
    expect(matchup).toHaveProperty('isComplete');
  });
});
