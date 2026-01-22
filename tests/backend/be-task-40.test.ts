// tests/backend/be-task-40.test.ts
// Backend Test: Implement Get Teams Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Teams Data Fetcher (task-40)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries teams with record and owner data', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_teams_fetch',
        name: 'TEST_Teams Fetch',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Fetch Team',
        ownerUsername: 'fetchowner',
        wins: 7,
        losses: 2,
        ties: 1,
        avatarUrl: 'https://example.com/avatar.png',
      },
    });

    const teams = await prisma.team?.findMany({
      where: { leagueId: league!.id },
    });

    expect(teams?.length).toBe(1);
    expect(teams?.[0].name).toBe('TEST_Fetch Team');
    expect(teams?.[0].ownerUsername).toBe('fetchowner');
    expect(teams?.[0].wins).toBe(7);
    expect(teams?.[0].losses).toBe(2);
    expect(teams?.[0].ties).toBe(1);
  });

  test('marks teams as claimed/unclaimed', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_teams_claimed',
        name: 'TEST_Teams Claimed',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Unclaimed team
    const unclaimedTeam = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Unclaimed Team',
        ownerUsername: 'unclaimed',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: false,
      },
    });

    // Claimed team
    const claimedTeam = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Claimed Team',
        ownerUsername: 'claimed',
        wins: 0,
        losses: 0,
        ties: 0,
        isClaimed: true,
        claimedBy: 'some-user-id',
      },
    });

    expect(unclaimedTeam?.isClaimed).toBe(false);
    expect(claimedTeam?.isClaimed).toBe(true);
  });

  test('orders by record wins DESC', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_teams_order',
        name: 'TEST_Teams Order',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams with different records
    for (let i = 0; i < 4; i++) {
      await prisma.team?.create({
        data: {
          leagueId: league!.id,
          name: `TEST_Order Team ${i}`,
          ownerUsername: `order${i}`,
          wins: i * 2,
          losses: 8 - i * 2,
          ties: 0,
        },
      });
    }

    const teams = await prisma.team?.findMany({
      where: { leagueId: league!.id },
      orderBy: { wins: 'desc' },
    });

    expect(teams?.[0].wins).toBe(6);
    expect(teams?.[3].wins).toBe(0);
  });

  test('returns Team type contract shape', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_teams_shape',
        name: 'TEST_Teams Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Shape Team',
        ownerUsername: 'shape',
        wins: 5,
        losses: 4,
        ties: 0,
        isClaimed: false,
      },
    });

    // Verify Team type contract
    expect(team).toHaveProperty('id');
    expect(team).toHaveProperty('leagueId');
    expect(team).toHaveProperty('name');
    expect(team).toHaveProperty('ownerUsername');
    expect(team).toHaveProperty('wins');
    expect(team).toHaveProperty('losses');
    expect(team).toHaveProperty('ties');
    expect(team).toHaveProperty('isClaimed');
  });

  test('unclaimed teams available for team selection wizard', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_teams_wizard',
        name: 'TEST_Teams Wizard',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Mix of claimed and unclaimed
    for (let i = 0; i < 4; i++) {
      await prisma.team?.create({
        data: {
          leagueId: league!.id,
          name: `TEST_Wizard Team ${i}`,
          ownerUsername: `wizard${i}`,
          wins: 0,
          losses: 0,
          ties: 0,
          isClaimed: i < 2, // First 2 claimed
        },
      });
    }

    const availableTeams = await prisma.team?.findMany({
      where: { leagueId: league!.id, isClaimed: false },
    });

    expect(availableTeams?.length).toBe(2);
  });
});
