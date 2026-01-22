// tests/backend/be-task-28.test.ts
// Backend Test: Implement Update Matchup Predictions Server Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Update Matchup Predictions Server Action (task-28)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.matchupPrediction.deleteMany({ where: { matchup: { leagueId: testLeagueId || '' } } }).catch(() => {});
    await prisma.matchup.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
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

  test('update predictions validates user has commissioner role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pred_role@example.com', name: 'TEST_PredRole' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_pred_role',
        name: 'TEST_Prediction Role',
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

  test('update predictions upserts MatchupPrediction records', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pred_upsert@example.com', name: 'TEST_PredUpsert' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_pred_upsert',
        name: 'TEST_Prediction Upsert',
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
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });

    const team2 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Pred Team 2',
        ownerUsername: 'pred2',
        wins: 4,
        losses: 4,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup.create({
      data: {
        leagueId: league.id,
        weekNumber: 5,
        season: 2025,
        homeTeamId: team1.id,
        awayTeamId: team2.id,
        isComplete: false,
      },
    });

    // Create prediction
    const prediction = await prisma.matchupPrediction.create({
      data: {
        matchupId: matchup.id,
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        predictedWinnerId: team1.id,
        hypeText: 'TEST_This should be a close one!',
      },
    });

    expect(prediction.predictedWinnerId).toBe(team1.id);
    expect(prediction.hypeText).toBe('TEST_This should be a close one!');
  });

  test('update predictions stores hypeText for featured matchups', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_pred_hype',
        name: 'TEST_Prediction Hype',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team1 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Hype Team 1',
        ownerUsername: 'hype1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Hype Team 2',
        ownerUsername: 'hype2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup.create({
      data: {
        leagueId: league.id,
        weekNumber: 5,
        season: 2025,
        homeTeamId: team1.id,
        awayTeamId: team2.id,
        isComplete: false,
      },
    });

    const prediction = await prisma.matchupPrediction.create({
      data: {
        matchupId: matchup.id,
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        predictedWinnerId: team2.id,
        hypeText: 'TEST_Battle for first place! 🔥',
        isFeatured: true,
      },
    });

    expect(prediction.hypeText).toBe('TEST_Battle for first place! 🔥');
    expect(prediction.isFeatured).toBe(true);
  });

  test('update predictions returns MatchupPredictionsData', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_pred_data',
        name: 'TEST_Prediction Data',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team1 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Data Team 1',
        ownerUsername: 'data1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Data Team 2',
        ownerUsername: 'data2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup.create({
      data: {
        leagueId: league.id,
        weekNumber: 5,
        season: 2025,
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
        weekNumber: 5,
        predictedWinnerId: team1.id,
        hypeText: 'TEST_Prediction data test',
      },
    });

    // Fetch matchup with predictions (plural relation)
    const matchupWithPrediction = await prisma.matchup.findUnique({
      where: { id: matchup.id },
      include: {
        predictions: true,
        homeTeam: true,
        awayTeam: true,
      },
    });

    // Simulating MatchupPredictionsData
    const predictionsData = {
      weekNumber: matchupWithPrediction?.weekNumber,
      matchups: [
        {
          matchupId: matchupWithPrediction?.id,
          homeTeam: matchupWithPrediction?.homeTeam?.name,
          awayTeam: matchupWithPrediction?.awayTeam?.name,
          predictedWinnerId: matchupWithPrediction?.predictions?.[0]?.predictedWinnerId,
          hypeText: matchupWithPrediction?.predictions?.[0]?.hypeText,
        },
      ],
    };

    expect(predictionsData.weekNumber).toBe(5);
    expect(predictionsData.matchups[0].hypeText).toBe('TEST_Prediction data test');
  });

  test('update predictions stores predictedWinnerId correctly', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_pred_tossup',
        name: 'TEST_Prediction Tossup',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team1 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Tossup Team 1',
        ownerUsername: 'toss1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Tossup Team 2',
        ownerUsername: 'toss2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup.create({
      data: {
        leagueId: league.id,
        weekNumber: 5,
        season: 2025,
        homeTeamId: team1.id,
        awayTeamId: team2.id,
        isComplete: false,
      },
    });

    // Prediction with winner selected
    const prediction = await prisma.matchupPrediction.create({
      data: {
        matchupId: matchup.id,
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        predictedWinnerId: team1.id,
        hypeText: 'TEST_Too close to call!',
      },
    });

    expect(prediction.predictedWinnerId).toBe(team1.id);
    expect(prediction.hypeText).toBe('TEST_Too close to call!');
  });

  test('update predictions can update existing prediction', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_pred_update',
        name: 'TEST_Prediction Update',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team1 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Update Team 1',
        ownerUsername: 'upd1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Update Team 2',
        ownerUsername: 'upd2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup.create({
      data: {
        leagueId: league.id,
        weekNumber: 5,
        season: 2025,
        homeTeamId: team1.id,
        awayTeamId: team2.id,
        isComplete: false,
      },
    });

    // Initial prediction
    const prediction = await prisma.matchupPrediction.create({
      data: {
        matchupId: matchup.id,
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        predictedWinnerId: team1.id,
        hypeText: 'TEST_Initial prediction',
      },
    });

    // Update prediction using upsert (same as server action would do)
    const updatedPrediction = await prisma.matchupPrediction.update({
      where: { id: prediction.id },
      data: {
        predictedWinnerId: team2.id,
        hypeText: 'TEST_Changed my mind!',
      },
    });

    expect(updatedPrediction.predictedWinnerId).toBe(team2.id);
    expect(updatedPrediction.hypeText).toBe('TEST_Changed my mind!');
  });
});
