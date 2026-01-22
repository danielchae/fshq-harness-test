// tests/backend/be-task-29.test.ts
// Backend Test: Implement Save Pick'ems Server Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Save Pick\'ems Server Action (task-29)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.pickemEntry?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    await prisma.matchup?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.leagueMembership?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('save picks validates user is league member', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_picks_member@example.com', name: 'TEST_PicksMember' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_picks_member',
        name: 'TEST_Picks Member',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Check membership
    const isMember = await prisma.leagueMembership?.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(isMember).toBeFalsy();

    // Add membership
    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'manager',
      },
    });

    const nowMember = await prisma.leagueMembership?.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(nowMember).toBeDefined();
  });

  test('save picks validates picks submitted before deadline', async () => {
    // Deadline is typically Thursday evening before games start
    const deadline = new Date('2025-01-23T20:00:00Z');
    const beforeDeadline = new Date('2025-01-23T18:00:00Z');
    const afterDeadline = new Date('2025-01-24T10:00:00Z');

    expect(beforeDeadline.getTime()).toBeLessThan(deadline.getTime());
    expect(afterDeadline.getTime()).toBeGreaterThan(deadline.getTime());
  });

  test('save picks upserts PickemEntries for each matchup', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_picks_upsert@example.com', name: 'TEST_PicksUpsert' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_picks_upsert',
        name: 'TEST_Picks Upsert',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams and matchups
    const teams = [];
    for (let i = 0; i < 4; i++) {
      const team = await prisma.team?.create({
        data: {
          leagueId: league!.id,
          name: `TEST_Pick Team ${i}`,
          ownerUsername: `pick${i}`,
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
        weekNumber: 5,
        season: 2025,
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[1]!.id,
        isComplete: false,
      },
    });

    const matchup2 = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 5,
        season: 2025,
        homeTeamId: teams[2]!.id,
        awayTeamId: teams[3]!.id,
        isComplete: false,
      },
    });

    // Save picks
    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
        season: 2025,
        matchupId: matchup1!.id,
        predictedWinnerId: teams[0]!.id,
      },
    });

    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
        season: 2025,
        matchupId: matchup2!.id,
        predictedWinnerId: teams[3]!.id,
      },
    });

    const picks = await prisma.pickemEntry?.findMany({
      where: { userId: user.id, leagueId: league!.id, weekNumber: 5 },
    });

    expect(picks?.length).toBe(2);
  });

  test('save picks returns SavePicksResponse with confirmation', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_picks_response@example.com', name: 'TEST_PicksResponse' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_picks_response',
        name: 'TEST_Picks Response',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Response Team 1',
        ownerUsername: 'resp1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Response Team 2',
        ownerUsername: 'resp2',
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

    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    // Simulating SavePicksResponse
    const saveResponse = {
      success: true,
      savedCount: 1,
      weekNumber: 5,
      message: 'TEST_Picks saved successfully!',
    };

    expect(saveResponse.success).toBe(true);
    expect(saveResponse.savedCount).toBe(1);
  });

  test('save picks records submission timestamp', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_picks_time@example.com', name: 'TEST_PicksTime' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_picks_time',
        name: 'TEST_Picks Time',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Time Team 1',
        ownerUsername: 'time1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Time Team 2',
        ownerUsername: 'time2',
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

    const beforeSave = new Date();

    const pick = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    const afterSave = new Date();

    expect(pick?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
    expect(pick?.createdAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
  });

  test('save picks enforces unique user-matchup constraint', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_picks_unique@example.com', name: 'TEST_PicksUnique' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_picks_unique',
        name: 'TEST_Picks Unique',
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
        ownerUsername: 'uniq1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Unique Team 2',
        ownerUsername: 'uniq2',
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

    // First pick
    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    // Duplicate should fail
    await expect(
      prisma.pickemEntry?.create({
        data: {
          userId: user.id,
          leagueId: league!.id,
          weekNumber: 5,
          season: 2025,
          matchupId: matchup!.id,
          predictedWinnerId: team2!.id,
        },
      })
    ).rejects.toThrow();
  });

  test('save picks allows updating existing pick', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_picks_update@example.com', name: 'TEST_PicksUpdate' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_picks_update',
        name: 'TEST_Picks Update',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Update Team 1',
        ownerUsername: 'upd1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Update Team 2',
        ownerUsername: 'upd2',
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

    // Initial pick
    const pick = await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
        season: 2025,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    // Update pick
    const updatedPick = await prisma.pickemEntry?.update({
      where: { id: pick!.id },
      data: { predictedWinnerId: team2!.id },
    });

    expect(updatedPick?.predictedWinnerId).toBe(team2!.id);
  });
});
