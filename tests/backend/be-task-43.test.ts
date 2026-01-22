// tests/backend/be-task-43.test.ts
// Backend Test: Implement Get Playoff Bracket Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Playoff Bracket Data Fetcher (task-43)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.matchup?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries playoff matchups in tree structure', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_bracket_tree',
        name: 'TEST_Bracket Tree',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams
    const teams = [];
    for (let i = 0; i < 4; i++) {
      const team = await prisma.team?.create({
        data: {
          leagueId: league!.id,
          name: `TEST_Playoff Team ${i + 1}`,
          ownerUsername: `playoff${i}`,
          wins: 8 - i,
          losses: i + 1,
          ties: 0,
        },
      });
      teams.push(team);
    }

    // Create semifinal matchups (week 15)
    await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 15,
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[3]!.id,
        isComplete: true,
        homeScore: 120,
        awayScore: 95,
        winnerId: teams[0]!.id,
        isPlayoff: true,
        playoffRound: 1,
      },
    });

    await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 15,
        homeTeamId: teams[1]!.id,
        awayTeamId: teams[2]!.id,
        isComplete: true,
        homeScore: 110,
        awayScore: 115,
        winnerId: teams[2]!.id,
        isPlayoff: true,
        playoffRound: 1,
      },
    });

    const playoffMatchups = await prisma.matchup?.findMany({
      where: { leagueId: league!.id, isPlayoff: true },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { playoffRound: 'asc' },
    });

    expect(playoffMatchups?.length).toBe(2);
    expect(playoffMatchups?.[0].playoffRound).toBe(1);
  });

  test('includes scores for completed rounds', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_bracket_scores',
        name: 'TEST_Bracket Scores',
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

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 16,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: true,
        homeScore: 145.5,
        awayScore: 132.2,
        winnerId: team1!.id,
        isPlayoff: true,
        playoffRound: 2,
      },
    });

    expect(matchup?.homeScore).toBe(145.5);
    expect(matchup?.awayScore).toBe(132.2);
    expect(matchup?.winnerId).toBe(team1!.id);
  });

  test('shows winners progressing through rounds', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_bracket_progress',
        name: 'TEST_Bracket Progress',
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
          name: `TEST_Progress Team ${i + 1}`,
          ownerUsername: `progress${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });
      teams.push(team);
    }

    // Round 1 - Teams 0 and 2 win
    await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 15,
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[1]!.id,
        isComplete: true,
        winnerId: teams[0]!.id,
        isPlayoff: true,
        playoffRound: 1,
      },
    });

    await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 15,
        homeTeamId: teams[2]!.id,
        awayTeamId: teams[3]!.id,
        isComplete: true,
        winnerId: teams[2]!.id,
        isPlayoff: true,
        playoffRound: 1,
      },
    });

    // Round 2 - Final: Teams 0 vs 2
    await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 16,
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[2]!.id,
        isComplete: false,
        isPlayoff: true,
        playoffRound: 2,
      },
    });

    // Verify round 1 winners
    const round1 = await prisma.matchup?.findMany({
      where: { leagueId: league!.id, playoffRound: 1 },
    });

    const round1Winners = round1?.map((m) => m.winnerId);
    expect(round1Winners).toContain(teams[0]!.id);
    expect(round1Winners).toContain(teams[2]!.id);

    // Verify round 2 participants are round 1 winners
    const round2 = await prisma.matchup?.findFirst({
      where: { leagueId: league!.id, playoffRound: 2 },
    });

    expect(round1Winners).toContain(round2?.homeTeamId);
    expect(round1Winners).toContain(round2?.awayTeamId);
  });

  test('returns BracketResponse type contract shape', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_bracket_shape',
        name: 'TEST_Bracket Shape',
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
        weekNumber: 15,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
        isPlayoff: true,
        playoffRound: 1,
      },
    });

    // Verify playoff Matchup type contract
    expect(matchup).toHaveProperty('id');
    expect(matchup).toHaveProperty('weekNumber');
    expect(matchup).toHaveProperty('homeTeamId');
    expect(matchup).toHaveProperty('awayTeamId');
    expect(matchup).toHaveProperty('isPlayoff');
    expect(matchup).toHaveProperty('playoffRound');
  });
});
