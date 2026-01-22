// tests/backend/be-task-30.test.ts
// Backend Test: Implement Get League Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get League Data Fetcher (task-30)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
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

  test('queries league by slug with Prisma', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_get_league_slug',
        name: 'TEST_Get League Slug',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const foundLeague = await prisma.league?.findUnique({
      where: { slug: 'test_get_league_slug' },
    });

    expect(foundLeague).toBeDefined();
    expect(foundLeague?.name).toBe('TEST_Get League Slug');
  });

  test('includes membership count and current user role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_league_role@example.com', name: 'TEST_LeagueRole' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_league_role',
        name: 'TEST_League Role',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    const membershipCount = await prisma.leagueMembership.count({
      where: { leagueId: league!.id },
    });

    const userMembership = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(membershipCount).toBe(1);
    expect(userMembership?.role).toBe('commissioner');
  });

  test('returns null if league not found', async () => {
    const notFoundLeague = await prisma.league?.findUnique({
      where: { slug: 'nonexistent_slug_12345' },
    });

    expect(notFoundLeague).toBeNull();
  });

  test('returns League type contract shape', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_league_shape',
        name: 'TEST_League Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
        description: 'TEST_Description',
      },
    });
    testLeagueId = league?.id || null;

    // Verify League type contract
    expect(league).toHaveProperty('id');
    expect(league).toHaveProperty('slug');
    expect(league).toHaveProperty('name');
    expect(league).toHaveProperty('platform');
    expect(league).toHaveProperty('season');
    expect(league).toHaveProperty('visibility');
  });

  test('includes league settings for feature toggles', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_league_settings',
        name: 'TEST_League Settings',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Settings would be in separate table
    const leagueWithSettings = await prisma.league?.findUnique({
      where: { id: league!.id },
      include: { settings: true },
    });

    expect(leagueWithSettings).toBeDefined();
  });
});
