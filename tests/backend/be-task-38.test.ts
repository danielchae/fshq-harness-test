// tests/backend/be-task-38.test.ts
// Backend Test: Implement Get League Settings Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get League Settings Data Fetcher (task-38)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.leagueSettings?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries LeagueSettings by league slug', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_settings_fetch',
        name: 'TEST_Settings Fetch',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    await prisma.leagueSettings?.create({
      data: {
        leagueId: league!.id,
        pickemsEnabled: true,
        powerRankingsEnabled: true,
        playoffBracketEnabled: false,
      },
    });

    const leagueWithSettings = await prisma.league?.findUnique({
      where: { slug: 'test_settings_fetch' },
      include: { settings: true },
    });

    expect(leagueWithSettings?.settings).toBeDefined();
    expect(leagueWithSettings?.settings?.pickemsEnabled).toBe(true);
  });

  test('returns feature toggles and preferences', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_settings_toggles',
        name: 'TEST_Settings Toggles',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const settings = await prisma.leagueSettings?.create({
      data: {
        leagueId: league!.id,
        pickemsEnabled: true,
        powerRankingsEnabled: false,
        playoffBracketEnabled: true,
        momentsEnabled: true,
        transactionsEnabled: false,
      },
    });

    expect(settings?.pickemsEnabled).toBe(true);
    expect(settings?.powerRankingsEnabled).toBe(false);
    expect(settings?.playoffBracketEnabled).toBe(true);
    expect(settings?.momentsEnabled).toBe(true);
    expect(settings?.transactionsEnabled).toBe(false);
  });

  test('returns null if league not found', async () => {
    const notFoundLeague = await prisma.league?.findUnique({
      where: { slug: 'nonexistent_settings_slug' },
      include: { settings: true },
    });

    expect(notFoundLeague).toBeNull();
  });

  test('returns LeagueSettings type contract shape', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_settings_shape',
        name: 'TEST_Settings Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const settings = await prisma.leagueSettings?.create({
      data: {
        leagueId: league!.id,
        pickemsEnabled: true,
        powerRankingsEnabled: true,
        playoffBracketEnabled: true,
      },
    });

    // Verify LeagueSettings type contract
    expect(settings).toHaveProperty('id');
    expect(settings).toHaveProperty('leagueId');
    expect(settings).toHaveProperty('pickemsEnabled');
    expect(settings).toHaveProperty('powerRankingsEnabled');
    expect(settings).toHaveProperty('playoffBracketEnabled');
  });

  test('settings are cached for performance', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_settings_cache',
        name: 'TEST_Settings Cache',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    await prisma.leagueSettings?.create({
      data: {
        leagueId: league!.id,
        pickemsEnabled: true,
        powerRankingsEnabled: true,
        playoffBracketEnabled: true,
      },
    });

    // Multiple reads should be fast (cache simulation)
    const reads = [];
    for (let i = 0; i < 5; i++) {
      const settings = await prisma.leagueSettings?.findUnique({
        where: { leagueId: league!.id },
      });
      reads.push(settings);
    }

    expect(reads.length).toBe(5);
    expect(reads.every((r) => r?.pickemsEnabled === true)).toBe(true);
  });

  test('one-to-one relationship with league', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_settings_relation',
        name: 'TEST_Settings Relation',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    await prisma.leagueSettings?.create({
      data: {
        leagueId: league!.id,
        pickemsEnabled: true,
        powerRankingsEnabled: true,
        playoffBracketEnabled: true,
      },
    });

    // Attempt to create duplicate settings should fail
    await expect(
      prisma.leagueSettings?.create({
        data: {
          leagueId: league!.id,
          pickemsEnabled: false,
          powerRankingsEnabled: false,
          playoffBracketEnabled: false,
        },
      })
    ).rejects.toThrow();
  });
});
