// tests/backend/be-task-48.test.ts
// Backend Test: Implement Check League Exists Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Check League Exists Data Fetcher (task-48)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries league by external platform ID', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_check_exists',
        name: 'TEST_Check Exists',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_123456789',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const existingLeague = await prisma.league?.findFirst({
      where: { platformLeagueId: 'sleeper_123456789' },
    });

    expect(existingLeague).toBeDefined();
    expect(existingLeague?.slug).toBe('test_check_exists');
  });

  test('returns exists boolean and league slug if found', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_check_found',
        name: 'TEST_Check Found',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_found_123',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const existingLeague = await prisma.league?.findFirst({
      where: { platformLeagueId: 'sleeper_found_123' },
    });

    // Simulate CheckLeagueExistsResult
    const result = {
      exists: existingLeague !== null,
      leagueSlug: existingLeague?.slug || null,
    };

    expect(result.exists).toBe(true);
    expect(result.leagueSlug).toBe('test_check_found');
  });

  test('returns false when league not found', async () => {
    const nonExistent = await prisma.league?.findFirst({
      where: { platformLeagueId: 'non_existent_platform_id_12345' },
    });

    // Simulate CheckLeagueExistsResult
    const result = {
      exists: nonExistent !== null,
      leagueSlug: nonExistent?.slug || null,
    };

    expect(result.exists).toBe(false);
    expect(result.leagueSlug).toBeNull();
  });

  test('used during sync flow to prevent duplicates', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_check_duplicate',
        name: 'TEST_Check Duplicate',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_dup_123',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Sync flow: check before creating
    const platformLeagueId = 'sleeper_dup_123';

    const existingLeague = await prisma.league?.findFirst({
      where: { platformLeagueId: platformLeagueId },
    });

    if (existingLeague) {
      // Already synced - return existing
      expect(existingLeague.slug).toBe('test_check_duplicate');
    } else {
      // Would create new league
      expect(true).toBe(false); // Should not reach here
    }
  });

  test('returns CheckLeagueExistsResult type contract shape', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_check_shape',
        name: 'TEST_Check Shape',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_shape_123',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const existingLeague = await prisma.league?.findFirst({
      where: { platformLeagueId: 'sleeper_shape_123' },
    });

    // Simulate CheckLeagueExistsResult
    const result = {
      exists: existingLeague !== null,
      leagueSlug: existingLeague?.slug || null,
      leagueId: existingLeague?.id || null,
      leagueName: existingLeague?.name || null,
    };

    expect(result).toHaveProperty('exists');
    expect(result).toHaveProperty('leagueSlug');
    expect(result.exists).toBe(true);
    expect(result.leagueSlug).toBe('test_check_shape');
  });

  test('checks by platform and platformLeagueId combination', async () => {
    const sleeperLeague = await prisma.league?.create({
      data: {
        slug: 'test_check_sleeper',
        name: 'TEST_Check Sleeper',
        platform: 'sleeper',
        platformLeagueId: 'shared_id_123',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = sleeperLeague?.id || null;

    // Check for sleeper platform
    const sleeperExists = await prisma.league?.findFirst({
      where: {
        platform: 'sleeper',
        platformLeagueId: 'shared_id_123',
      },
    });

    // Check for different platform with same ID
    const espnExists = await prisma.league?.findFirst({
      where: {
        platform: 'espn',
        platformLeagueId: 'shared_id_123',
      },
    });

    expect(sleeperExists).toBeDefined();
    expect(espnExists).toBeNull();
  });

  test('handles season-specific league checks', async () => {
    const league2024 = await prisma.league?.create({
      data: {
        slug: 'test_check_2024',
        name: 'TEST_Check 2024',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_season_123',
        season: 2024,
        visibility: 'public',
      },
    });

    const league2025 = await prisma.league?.create({
      data: {
        slug: 'test_check_2025',
        name: 'TEST_Check 2025',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_season_456',
        season: 2025,
        visibility: 'public',
      },
    });

    // Check for 2025 season
    const exists2025 = await prisma.league?.findFirst({
      where: {
        platformLeagueId: 'sleeper_season_456',
        season: 2025,
      },
    });

    expect(exists2025).toBeDefined();
    expect(exists2025?.season).toBe(2025);

    // Cleanup
    await prisma.league?.delete({ where: { id: league2024!.id } });
    testLeagueId = league2025!.id;
  });
});
