// tests/backend/be-task-03.test.ts
// Backend Test: Create Teams Table Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Teams Table Schema (task-03)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    // Clean up test data
    await prisma.team?.deleteMany({ where: { name: { startsWith: 'TEST_' } } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('teams table exists with required fields', async () => {
    // First create a league to reference
    const league = await prisma.league?.create({
      data: {
        slug: 'test_teams_league',
        name: 'TEST_Teams League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Team One',
        ownerUsername: 'test_owner',
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });

    expect(team).toBeDefined();
    if (team) {
      expect(team.id).toBeDefined();
      expect(team.leagueId).toBe(league!.id);
      expect(team.name).toBe('TEST_Team One');
      expect(team.ownerUsername).toBe('test_owner');
      expect(team.wins).toBe(5);
      expect(team.losses).toBe(3);
      expect(team.ties).toBe(0);
    }
  });

  test('enforces foreign key to leagues table', async () => {
    // Attempt to create a team with non-existent leagueId
    await expect(
      prisma.team?.create({
        data: {
          leagueId: 'non-existent-league-id',
          name: 'TEST_Orphan Team',
          ownerUsername: 'test_owner',
          wins: 0,
          losses: 0,
          ties: 0,
        },
      })
    ).rejects.toThrow();
  });

  test('supports isClaimed flag for team claiming', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_claimed_league',
        name: 'TEST_Claimed League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Claimable Team',
        ownerUsername: 'test_owner',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: false,
      },
    });

    expect(team?.isClaimed).toBe(false);

    const updatedTeam = await prisma.team?.update({
      where: { id: team!.id },
      data: { isClaimed: true },
    });

    expect(updatedTeam?.isClaimed).toBe(true);
  });

  test('Team type matches frontend expectations', async () => {
    // Frontend expects Team with id, name, ownerUsername, avatarUrl, record (wins, losses, ties), isClaimed
    const league = await prisma.league?.create({
      data: {
        slug: 'test_team_type',
        name: 'TEST_Team Type League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Type Contract Team',
        ownerUsername: 'test_owner',
        avatarUrl: 'https://example.com/team.png',
        wins: 8,
        losses: 4,
        ties: 1,
        isClaimed: true,
      },
    });

    expect(team).toHaveProperty('id');
    expect(team).toHaveProperty('name');
    expect(team).toHaveProperty('ownerUsername');
    expect(team).toHaveProperty('avatarUrl');
    expect(team).toHaveProperty('wins');
    expect(team).toHaveProperty('losses');
    expect(team).toHaveProperty('ties');
    expect(team).toHaveProperty('isClaimed');
  });
});
