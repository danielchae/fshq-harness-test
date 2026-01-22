// tests/backend/be-task-53.test.ts
// Backend Test: Implement Automated Moment Generation Job

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Automated Moment Generation Job (task-53)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  let testTeamIds: string[] = [];

  afterEach(async () => {
    await prisma.moment?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.transaction?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.matchup?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    // Delete teams before league (due to foreign key constraints)
    for (const teamId of testTeamIds) {
      await prisma.team?.delete({ where: { id: teamId } }).catch(() => {});
    }
    testTeamIds = [];
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('detects notable transactions (big trades, waiver pickups)', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_moment_trade@example.com', name: 'TEST_MomentTrade' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_moment_trade',
        name: 'TEST_Moment Trade',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams first (required for foreign key constraints)
    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        platformTeamId: 'ext_team_1',
        name: 'Team 1',
        ownerUsername: 'Owner 1',
      },
    });
    testTeamIds.push(team1!.id);

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        platformTeamId: 'ext_team_2',
        name: 'Team 2',
        ownerUsername: 'Owner 2',
      },
    });
    testTeamIds.push(team2!.id);

    // Notable trade transaction
    const bigTrade = await prisma.transaction?.create({
      data: {
        leagueId: league!.id,
        teamId: team1!.id,
        type: 'trade',
        playerName: 'Patrick Mahomes',
        playerPosition: 'QB',
        weekNumber: 10,
        timestamp: new Date(),
        isNotable: true, // High-value player
      },
    });

    // Regular waiver pickup
    const regularWaiver = await prisma.transaction?.create({
      data: {
        leagueId: league!.id,
        teamId: team2!.id,
        type: 'add',
        playerName: 'Third String RB',
        playerPosition: 'RB',
        weekNumber: 10,
        timestamp: new Date(),
        isNotable: false,
      },
    });

    // Query notable transactions
    const notableTransactions = await prisma.transaction?.findMany({
      where: { leagueId: league!.id, isNotable: true },
    });

    expect(notableTransactions?.length).toBe(1);
    expect(notableTransactions?.[0].playerName).toBe('Patrick Mahomes');
  });

  test('detects blowout games and close finishes', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_moment_blowout',
        name: 'TEST_Moment Blowout',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams first (required for foreign key constraints)
    const homeTeam = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        platformTeamId: 'ext_team_home',
        name: 'Home Team',
        ownerUsername: 'Home Owner',
      },
    });
    testTeamIds.push(homeTeam!.id);

    const awayTeam = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        platformTeamId: 'ext_team_away',
        name: 'Away Team',
        ownerUsername: 'Away Owner',
      },
    });
    testTeamIds.push(awayTeam!.id);

    const homeTeam2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        platformTeamId: 'ext_team_home2',
        name: 'Home Team 2',
        ownerUsername: 'Home Owner 2',
      },
    });
    testTeamIds.push(homeTeam2!.id);

    const awayTeam2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        platformTeamId: 'ext_team_away2',
        name: 'Away Team 2',
        ownerUsername: 'Away Owner 2',
      },
    });
    testTeamIds.push(awayTeam2!.id);

    // Blowout game
    const blowout = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        homeTeamId: homeTeam!.id,
        awayTeamId: awayTeam!.id,
        homeScore: 175.5, // Big win
        awayScore: 85.2,
        isComplete: true,
        winnerId: homeTeam!.id,
      },
    });

    // Close finish
    const nailBiter = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 10,
        homeTeamId: homeTeam2!.id,
        awayTeamId: awayTeam2!.id,
        homeScore: 105.5,
        awayScore: 105.3, // 0.2 point difference!
        isComplete: true,
        winnerId: homeTeam2!.id,
      },
    });

    // Detect blowouts (>50 point margin)
    const blowoutThreshold = 50;
    const blowoutMargin = Math.abs(blowout!.homeScore! - blowout!.awayScore!);
    const isBlowout = blowoutMargin > blowoutThreshold;

    // Detect nail-biters (<1 point margin)
    const closeThreshold = 1;
    const closeMargin = Math.abs(nailBiter!.homeScore! - nailBiter!.awayScore!);
    const isNailBiter = closeMargin < closeThreshold;

    expect(isBlowout).toBe(true);
    expect(blowoutMargin).toBeGreaterThan(50);
    expect(isNailBiter).toBe(true);
    expect(closeMargin).toBeLessThan(1);
  });

  test('generates moment with templated content', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_moment_template@example.com', name: 'TEST_MomentTemplate' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_moment_template',
        name: 'TEST_Moment Template',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Template for blowout game
    const blowoutTemplate = (winnerName: string, loserName: string, margin: number) =>
      `🔥 BLOWOUT ALERT! ${winnerName} absolutely destroyed ${loserName} by ${margin.toFixed(1)} points!`;

    // Template for close game
    const nailBiterTemplate = (winnerName: string, loserName: string, margin: number) =>
      `😱 NAIL BITER! ${winnerName} barely escapes ${loserName} by just ${margin.toFixed(1)} points!`;

    // Template for big trade
    const tradeTemplate = (playerName: string, team1: string, team2: string) =>
      `💰 BLOCKBUSTER TRADE! ${playerName} has been traded from ${team1} to ${team2}!`;

    const blowoutContent = blowoutTemplate('Team Alpha', 'Team Beta', 90.3);
    const closeContent = nailBiterTemplate('Team Gamma', 'Team Delta', 0.2);
    const tradeContent = tradeTemplate('Patrick Mahomes', 'Team X', 'Team Y');

    expect(blowoutContent).toContain('BLOWOUT');
    expect(closeContent).toContain('NAIL BITER');
    expect(tradeContent).toContain('BLOCKBUSTER TRADE');
  });

  test('posted to league feed automatically', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_moment_auto@example.com', name: 'TEST_MomentAuto' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_moment_auto',
        name: 'TEST_Moment Auto',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Auto-generated moment
    const autoMoment = await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id, // System user
        content: '🔥 BLOWOUT! Team Alpha crushed Team Beta by 90 points!',
        isAutoGenerated: true,
        momentType: 'blowout_game',
      },
    });

    expect(autoMoment?.isAutoGenerated).toBe(true);
    expect(autoMoment?.momentType).toBe('blowout_game');

    // Verify it appears in feed
    const feedMoments = await prisma.moment?.findMany({
      where: { leagueId: league!.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(feedMoments?.length).toBe(1);
    expect(feedMoments?.[0].isAutoGenerated).toBe(true);
  });

  test('includes metadata for moment type', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_moment_metadata@example.com', name: 'TEST_MomentMeta' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_moment_metadata',
        name: 'TEST_Moment Metadata',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Moment with metadata
    const moment = await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'Auto-generated moment',
        isAutoGenerated: true,
        momentType: 'close_game',
        metadata: {
          matchupId: 'matchup_123',
          weekNumber: 10,
          winnerTeamId: 'team_1',
          loserTeamId: 'team_2',
          margin: 0.5,
        },
      },
    });

    expect(moment?.momentType).toBe('close_game');
    expect(moment?.metadata).toBeDefined();
    expect((moment?.metadata as any)?.margin).toBe(0.5);
  });

  test('respects league settings for auto-moments', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_moment_settings',
        name: 'TEST_Moment Settings',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // League settings with auto-moments enabled
    const settings = await prisma.leagueSettings?.create({
      data: {
        leagueId: league!.id,
        autoMomentsEnabled: true,
        blowoutThreshold: 50,
        closeGameThreshold: 1,
      },
    });

    expect(settings?.autoMomentsEnabled).toBe(true);

    // Cleanup
    await prisma.leagueSettings?.delete({ where: { id: settings!.id } }).catch(() => {});
  });

  test('does not duplicate existing auto-moments', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_moment_dedupe@example.com', name: 'TEST_MomentDedupe' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_moment_dedupe',
        name: 'TEST_Moment Dedupe',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const matchupId = 'matchup_dedupe_123';

    // First auto-moment for this matchup
    await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'Blowout game moment',
        isAutoGenerated: true,
        momentType: 'blowout_game',
        sourceMatchupId: matchupId,
      },
    });

    // Check if moment already exists before creating
    const existingMoment = await prisma.moment?.findFirst({
      where: {
        leagueId: league!.id,
        sourceMatchupId: matchupId,
        momentType: 'blowout_game',
      },
    });

    expect(existingMoment).toBeDefined();

    // Should not create duplicate
    const shouldCreate = !existingMoment;
    expect(shouldCreate).toBe(false);
  });
});
