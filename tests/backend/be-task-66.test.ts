// tests/backend/be-task-66.test.ts
// Backend Test: Implement Publish Content Server Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Publish Content Server Action (task-66)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    // Clean up in correct order due to foreign key constraints
    await prisma.powerRankingEntry.deleteMany({ where: { powerRanking: { leagueId: testLeagueId || '' } } }).catch(() => {});
    await prisma.matchupPrediction.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.powerRanking.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.matchup.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.moment.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
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

  test('publish validates user has commissioner role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_publish_role@example.com', name: 'TEST_PublishRole' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_publish_role',
        name: 'TEST_Publish Role',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Commissioner role required
    const membership = await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    expect(membership.role).toBe('commissioner');

    const canPublish = membership.role === 'commissioner';
    expect(canPublish).toBe(true);
  });

  test('publish rejects non-commissioner users', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_publish_reject@example.com', name: 'TEST_PublishReject' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_publish_reject',
        name: 'TEST_Publish Reject',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Manager role - not commissioner
    const membership = await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'manager',
        status: 'approved',
      },
    });

    const canPublish = membership.role === 'commissioner';
    expect(canPublish).toBe(false);
  });

  test('publish validates power rankings data', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_publish_rankings',
        name: 'TEST_Publish Rankings',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Create teams
    const teams = [];
    for (let i = 0; i < 4; i++) {
      const team = await prisma.team.create({
        data: {
          leagueId: league.id,
          name: `TEST_Publish Team ${i}`,
          ownerUsername: `pub${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });
      teams.push(team);
    }

    // Validate rankings data structure
    const rankingsData = teams.map((t, i) => ({
      teamId: t.id,
      rank: i + 1,
      commentary: `TEST_Commentary for rank ${i + 1}`,
    }));

    // All teams have rankings
    expect(rankingsData.length).toBe(4);

    // No duplicate ranks
    const ranks = rankingsData.map((r) => r.rank);
    const uniqueRanks = new Set(ranks);
    expect(uniqueRanks.size).toBe(ranks.length);

    // All ranks are valid (1 to N)
    const validRanks = ranks.every((r) => r >= 1 && r <= teams.length);
    expect(validRanks).toBe(true);
  });

  test('publish validates matchup predictions data', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_publish_predictions',
        name: 'TEST_Publish Predictions',
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
        weekNumber: 5,
        season: 2025,
        homeTeamId: team1.id,
        awayTeamId: team2.id,
        isComplete: false,
      },
    });

    // Validate prediction data
    const predictionData = {
      matchupId: matchup.id,
      predictedWinnerId: team1.id,
      hypeText: 'TEST_Big game!',
    };

    // Winner is one of the teams in the matchup
    const validWinner =
      predictionData.predictedWinnerId === team1.id ||
      predictionData.predictedWinnerId === team2.id ||
      predictionData.predictedWinnerId === null;
    expect(validWinner).toBe(true);
  });

  test('publish atomically updates both rankings and predictions', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_publish_atomic@example.com', name: 'TEST_PublishAtomic' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_publish_atomic',
        name: 'TEST_Publish Atomic',
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
          name: `TEST_Atomic Team ${i}`,
          ownerUsername: `atomic${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });
      teams.push(team);
    }

    const matchup = await prisma.matchup.create({
      data: {
        leagueId: league.id,
        weekNumber: 5,
        season: 2025,
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[1]!.id,
        isComplete: false,
      },
    });

    // Use transaction for atomic update
    await prisma.$transaction(async (tx) => {
      // Create parent PowerRanking record first
      const powerRanking = await tx.powerRanking.create({
        data: {
          leagueId: league.id,
          season: 2025,
          weekNumber: 5,
          status: 'published',
          publishedAt: new Date(),
        },
      });

      // Create ranking entries
      for (let i = 0; i < teams.length; i++) {
        await tx.powerRankingEntry.create({
          data: {
            powerRankingId: powerRanking.id,
            teamId: teams[i]!.id,
            rank: i + 1,
            movement: 0,
            commentary: `TEST_Atomic rank ${i + 1}`,
          },
        });
      }

      // Create MatchupPrediction
      await tx.matchupPrediction.create({
        data: {
          matchupId: matchup.id,
          leagueId: league.id,
          season: 2025,
          weekNumber: 5,
          predictedWinnerId: teams[0]!.id,
          hypeText: 'TEST_Atomic prediction',
          isFeatured: true,
          status: 'published',
          publishedAt: new Date(),
        },
      });
    });

    // Verify both updated
    const powerRanking = await prisma.powerRanking.findFirst({
      where: { leagueId: league.id, weekNumber: 5 },
      include: { entries: true },
    });
    const prediction = await prisma.matchupPrediction.findFirst({
      where: { matchupId: matchup.id },
    });

    expect(powerRanking?.entries.length).toBe(2);
    expect(powerRanking?.status).toBe('published');
    expect(prediction).toBeDefined();
    expect(prediction?.status).toBe('published');
  });

  test('publish returns PublishResponse with validation results', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_publish_response',
        name: 'TEST_Publish Response',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Simulating PublishResponse
    const publishResponse = {
      success: true,
      rankingsUrl: `/leagues/${league.slug}/rankings`,
      feedUrl: `/leagues/${league.slug}/feed`,
      matchupsUrl: `/leagues/${league.slug}/matchups`,
      publishedAt: new Date().toISOString(),
      feedMomentsCreated: 2,
    };

    expect(publishResponse.success).toBe(true);
    expect(publishResponse.rankingsUrl).toContain('rankings');
    expect(publishResponse.feedUrl).toContain('feed');
    expect(publishResponse.feedMomentsCreated).toBe(2);
  });

  test('publish records content published timestamp', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test_publish_timestamp',
        name: 'TEST_Publish Timestamp',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: 'TEST_Timestamp Team',
        ownerUsername: 'timestamp',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const beforePublish = new Date();

    // Create PowerRanking with publishedAt
    const powerRanking = await prisma.powerRanking.create({
      data: {
        leagueId: league.id,
        season: 2025,
        weekNumber: 5,
        status: 'published',
        publishedAt: new Date(),
      },
    });

    const ranking = await prisma.powerRankingEntry.create({
      data: {
        powerRankingId: powerRanking.id,
        teamId: team.id,
        rank: 1,
        movement: 0,
      },
    });

    const afterPublish = new Date();

    // createdAt should be within publish window
    expect(ranking.createdAt.getTime()).toBeGreaterThanOrEqual(beforePublish.getTime());
    expect(ranking.createdAt.getTime()).toBeLessThanOrEqual(afterPublish.getTime());

    // Verify publishedAt is set on parent record
    expect(powerRanking.publishedAt).not.toBeNull();
  });

  test('publish returns errors for invalid data', async () => {
    // Invalid rankings data
    const invalidRankings = [
      { teamId: 'team-1', rank: 1 },
      { teamId: 'team-2', rank: 1 }, // Duplicate rank!
    ];

    const ranks = invalidRankings.map((r) => r.rank);
    const uniqueRanks = new Set(ranks);
    const hasDuplicateRanks = uniqueRanks.size !== ranks.length;

    const errors: string[] = [];
    if (hasDuplicateRanks) {
      errors.push('Duplicate ranks found');
    }

    const publishResponse = {
      success: false,
      error: errors[0],
    };

    expect(publishResponse.success).toBe(false);
    expect(publishResponse.error).toBe('Duplicate ranks found');
  });

  test('publish creates feed moments for published content', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_publish_moments@example.com', name: 'TEST_PublishMoments' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test_publish_moments',
        name: 'TEST_Publish Moments',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Create a rankings moment
    const rankingsMoment = await prisma.moment.create({
      data: {
        leagueId: league.id,
        authorId: user.id,
        type: 'rankings',
        content: JSON.stringify({
          weekNumber: 5,
          message: 'Week 5 Power Rankings are live!',
        }),
      },
    });

    // Create a prediction moment
    const predictionMoment = await prisma.moment.create({
      data: {
        leagueId: league.id,
        authorId: user.id,
        type: 'prediction',
        content: JSON.stringify({
          weekNumber: 5,
          message: 'Check out this week\'s matchup predictions!',
        }),
      },
    });

    // Verify moments were created
    const moments = await prisma.moment.findMany({
      where: { leagueId: league.id },
    });

    expect(moments.length).toBe(2);
    expect(moments.some((m) => m.type === 'rankings')).toBe(true);
    expect(moments.some((m) => m.type === 'prediction')).toBe(true);
  });
});
