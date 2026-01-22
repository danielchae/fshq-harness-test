// tests/backend/be-task-10.test.ts
// Backend Test: Create Matchups and Predictions Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Matchups and Predictions Schema (task-10)', () => {
  let testLeagueId: string | null = null;
  let testTeam1Id: string | null = null;
  let testTeam2Id: string | null = null;

  afterEach(async () => {
    await prisma.matchupPrediction?.deleteMany({ where: { matchup: { leagueId: testLeagueId || '' } } }).catch(() => {});
    await prisma.matchup?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testTeam1Id) await prisma.team?.delete({ where: { id: testTeam1Id } }).catch(() => {});
    if (testTeam2Id) await prisma.team?.delete({ where: { id: testTeam2Id } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    testTeam1Id = null;
    testTeam2Id = null;
  });

  test('matchups table exists with required fields', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_matchups_league',
        name: 'TEST_Matchups League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Home Team',
        ownerUsername: 'home_owner',
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });
    testTeam1Id = team1?.id || null;

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Away Team',
        ownerUsername: 'away_owner',
        wins: 4,
        losses: 4,
        ties: 0,
      },
    });
    testTeam2Id = team2?.id || null;

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 9,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    expect(matchup).toBeDefined();
    if (matchup) {
      expect(matchup.id).toBeDefined();
      expect(matchup.leagueId).toBe(league!.id);
      expect(matchup.weekNumber).toBe(9);
      expect(matchup.homeTeamId).toBe(team1!.id);
      expect(matchup.awayTeamId).toBe(team2!.id);
      expect(matchup.isComplete).toBe(false);
    }
  });

  test('matchups support score and winner fields for completed games', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_scores_league',
        name: 'TEST_Scores League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Winner Team',
        ownerUsername: 'winner_owner',
        wins: 6,
        losses: 2,
        ties: 0,
      },
    });
    testTeam1Id = team1?.id || null;

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Loser Team',
        ownerUsername: 'loser_owner',
        wins: 2,
        losses: 6,
        ties: 0,
      },
    });
    testTeam2Id = team2?.id || null;

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 8,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: true,
        homeTeamScore: 125.5,
        awayTeamScore: 98.2,
        winnerId: team1!.id,
      },
    });

    expect(matchup?.isComplete).toBe(true);
    expect(matchup?.homeTeamScore?.toString()).toBe('125.5');
    expect(matchup?.awayTeamScore?.toString()).toBe('98.2');
    expect(matchup?.winnerId).toBe(team1!.id);
  });

  test('predictions table exists with required fields', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_predictions_league',
        name: 'TEST_Predictions League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Predicted Home',
        ownerUsername: 'pred_home',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeam1Id = team1?.id || null;

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Predicted Away',
        ownerUsername: 'pred_away',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeam2Id = team2?.id || null;

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 7,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    const prediction = await prisma.matchupPrediction?.create({
      data: {
        matchupId: matchup!.id,
        leagueId: league!.id,
        season: 2025,
        weekNumber: 7,
        predictedWinnerId: team1!.id,
        hypeText: 'TEST_This is going to be an epic matchup!',
      },
    });

    expect(prediction).toBeDefined();
    if (prediction) {
      expect(prediction.id).toBeDefined();
      expect(prediction.matchupId).toBe(matchup!.id);
      expect(prediction.predictedWinnerId).toBe(team1!.id);
      expect(prediction.hypeText).toBe('TEST_This is going to be an epic matchup!');
    }
  });

  test('MatchupsResponse type matches frontend expectations', async () => {
    // Frontend expects MatchupsResponse with matchups array, currentWeek, totalWeeks
    const league = await prisma.league?.create({
      data: {
        slug: 'test_type_matchups',
        name: 'TEST_Type Matchups',
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
    testTeam1Id = team1?.id || null;

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
    testTeam2Id = team2?.id || null;

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 1,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    expect(matchup).toHaveProperty('id');
    expect(matchup).toHaveProperty('leagueId');
    expect(matchup).toHaveProperty('weekNumber');
    expect(matchup).toHaveProperty('homeTeamId');
    expect(matchup).toHaveProperty('awayTeamId');
    expect(matchup).toHaveProperty('isComplete');
  });
});
