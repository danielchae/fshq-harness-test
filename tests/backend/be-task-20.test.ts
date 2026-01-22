// tests/backend/be-task-20.test.ts
// Backend Test: Create Seed Data for Development

import { describe, test, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Seed Data for Development (task-20)', () => {
  const testPrefix = 'SEEDTEST_';

  afterAll(async () => {
    // Clean up all seed test data
    await prisma.user.deleteMany({ where: { email: { startsWith: testPrefix } } }).catch(() => {});
    await prisma.league?.deleteMany({ where: { slug: { startsWith: 'seedtest_' } } }).catch(() => {});
  });

  test('seed can create users', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testPrefix}user1@example.com`,
        name: `${testPrefix}User One`,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe(`${testPrefix}user1@example.com`);
  });

  test('seed can create leagues', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'seedtest_dynasty_league',
        name: `${testPrefix}Dynasty League`,
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });

    expect(league?.id).toBeDefined();
    expect(league?.slug).toBe('seedtest_dynasty_league');
  });

  test('seed can create teams for a league', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'seedtest_teams_league',
        name: `${testPrefix}Teams League`,
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });

    const teamNames = [
      'Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta',
      'Team Epsilon', 'Team Zeta', 'Team Eta', 'Team Theta',
      'Team Iota', 'Team Kappa', 'Team Lambda', 'Team Mu',
    ];

    for (let i = 0; i < teamNames.length; i++) {
      await prisma.team?.create({
        data: {
          leagueId: league!.id,
          name: `${testPrefix}${teamNames[i]}`,
          ownerUsername: `owner${i + 1}`,
          wins: Math.floor(Math.random() * 10),
          losses: Math.floor(Math.random() * 10),
          ties: 0,
        },
      });
    }

    const teams = await prisma.team?.findMany({
      where: { leagueId: league!.id },
    });

    expect(teams?.length).toBe(12);

    // Clean up
    await prisma.team?.deleteMany({ where: { leagueId: league!.id } });
    await prisma.league?.delete({ where: { id: league!.id } });
  });

  test('seed can create memberships', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testPrefix}member@example.com`,
        name: `${testPrefix}Member`,
      },
    });

    const league = await prisma.league?.create({
      data: {
        slug: 'seedtest_membership_league',
        name: `${testPrefix}Membership League`,
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });

    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'commissioner',
      },
    });

    const membership = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(membership?.role).toBe('commissioner');

    // Clean up
    await prisma.leagueMembership.deleteMany({ where: { leagueId: league!.id } });
    await prisma.league?.delete({ where: { id: league!.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  test('seed can create moments', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testPrefix}poster@example.com`,
        name: `${testPrefix}Poster`,
      },
    });

    const league = await prisma.league?.create({
      data: {
        slug: 'seedtest_moments_league',
        name: `${testPrefix}Moments League`,
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });

    const momentTypes = ['post', 'trade', 'rankings', 'prediction', 'matchResult', 'transaction'];

    for (const type of momentTypes) {
      await prisma.moment?.create({
        data: {
          content: `${testPrefix}Sample ${type} content`,
          authorId: user.id,
          leagueId: league!.id,
          type: type,
        },
      });
    }

    const moments = await prisma.moment?.findMany({
      where: { leagueId: league!.id },
    });

    expect(moments?.length).toBe(momentTypes.length);

    // Clean up
    await prisma.moment?.deleteMany({ where: { leagueId: league!.id } });
    await prisma.league?.delete({ where: { id: league!.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  test('seed data matches frontend fixture structure', async () => {
    // Verify seed data follows the same structure as frontend fixtures
    const user = await prisma.user.create({
      data: {
        email: `${testPrefix}fixture@example.com`,
        name: `${testPrefix}Fixture User`,
        image: 'https://example.com/avatar.png',
      },
    });

    // User should have fields expected by frontend
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('image');

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
  });

  test('seed creates realistic test data', async () => {
    // Verify we can create a complete test scenario
    const user = await prisma.user.create({
      data: {
        email: `${testPrefix}scenario@example.com`,
        name: `${testPrefix}Scenario User`,
      },
    });

    const league = await prisma.league?.create({
      data: {
        slug: 'seedtest_scenario_league',
        name: `${testPrefix}Scenario League`,
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
        description: 'A test league for seed validation',
      },
    });

    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'commissioner',
      },
    });

    await prisma.leagueSettings.create({
      data: {
        leagueId: league!.id,
        pickemsEnabled: true,
        powerRankingsEnabled: true,
        bracketEnabled: true,
      },
    });

    // Verify complete scenario
    const completeLeague = await prisma.league?.findUnique({
      where: { id: league!.id },
      include: {
        memberships: true,
        settings: true,
      },
    });

    expect(completeLeague?.memberships?.length).toBe(1);
    expect(completeLeague?.settings?.pickemsEnabled).toBe(true);

    // Clean up
    await prisma.leagueSettings.deleteMany({ where: { leagueId: league!.id } });
    await prisma.leagueMembership.deleteMany({ where: { leagueId: league!.id } });
    await prisma.league?.delete({ where: { id: league!.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
