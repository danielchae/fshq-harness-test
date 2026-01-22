// tests/backend/be-task-05.test.ts
// Backend Test: Create League Settings Table Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create League Settings Table Schema (task-05)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.leagueSettings?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('leagueSettings table exists with required fields', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_settings_league',
        name: 'TEST_Settings League',
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
        bracketEnabled: false,
      },
    });

    expect(settings).toBeDefined();
    if (settings) {
      expect(settings.id).toBeDefined();
      expect(settings.leagueId).toBe(league!.id);
      expect(settings.pickemsEnabled).toBe(true);
      expect(settings.powerRankingsEnabled).toBe(true);
      expect(settings.bracketEnabled).toBe(false);
    }
  });

  test('supports feature toggles for pickems, power rankings, bracket', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_toggles_league',
        name: 'TEST_Toggles League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // All features disabled
    const settingsDisabled = await prisma.leagueSettings?.create({
      data: {
        leagueId: league!.id,
        pickemsEnabled: false,
        powerRankingsEnabled: false,
        bracketEnabled: false,
      },
    });

    expect(settingsDisabled?.pickemsEnabled).toBe(false);
    expect(settingsDisabled?.powerRankingsEnabled).toBe(false);
    expect(settingsDisabled?.bracketEnabled).toBe(false);

    // Update to enable all features
    const settingsEnabled = await prisma.leagueSettings?.update({
      where: { id: settingsDisabled!.id },
      data: {
        pickemsEnabled: true,
        powerRankingsEnabled: true,
        bracketEnabled: true,
      },
    });

    expect(settingsEnabled?.pickemsEnabled).toBe(true);
    expect(settingsEnabled?.powerRankingsEnabled).toBe(true);
    expect(settingsEnabled?.bracketEnabled).toBe(true);
  });

  test('enforces one-to-one relationship with leagues', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_unique_settings',
        name: 'TEST_Unique Settings',
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
        bracketEnabled: true,
      },
    });

    // Attempt to create duplicate settings
    await expect(
      prisma.leagueSettings?.create({
        data: {
          leagueId: league!.id,
          pickemsEnabled: false,
          powerRankingsEnabled: false,
          bracketEnabled: false,
        },
      })
    ).rejects.toThrow(/unique/i);
  });

  test('LeagueSettings type matches frontend expectations', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_settings_type',
        name: 'TEST_Settings Type League',
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
        bracketEnabled: true,
      },
    });

    expect(settings).toHaveProperty('id');
    expect(settings).toHaveProperty('leagueId');
    expect(settings).toHaveProperty('pickemsEnabled');
    expect(settings).toHaveProperty('powerRankingsEnabled');
    expect(settings).toHaveProperty('bracketEnabled');
  });
});
