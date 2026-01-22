// tests/backend/be-task-02.test.ts
// Backend Test: Create Leagues Table Schema

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Leagues Table Schema (task-02)', () => {
  afterEach(async () => {
    // Clean up test data - leagues and related
    await prisma.league?.deleteMany({ where: { slug: { startsWith: 'test_' } } }).catch(() => {});
  });

  test('leagues table exists with required fields', async () => {
    // Test that we can create a league with required fields
    const league = await prisma.league?.create({
      data: {
        slug: 'test_league_schema',
        name: 'TEST_League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });

    expect(league).toBeDefined();
    if (league) {
      expect(league.id).toBeDefined();
      expect(league.slug).toBe('test_league_schema');
      expect(league.name).toBe('TEST_League');
      expect(league.platform).toBe('sleeper');
      expect(league.season).toBe(2025);
      expect(league.visibility).toBe('public');
    }
  });

  test('enforces unique constraint on slug', async () => {
    await prisma.league?.create({
      data: {
        slug: 'test_unique_slug',
        name: 'TEST_First League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });

    await expect(
      prisma.league?.create({
        data: {
          slug: 'test_unique_slug',
          name: 'TEST_Duplicate Slug',
          platform: 'sleeper',
          season: 2025,
          visibility: 'public',
        },
      })
    ).rejects.toThrow(/unique/i);
  });

  test('allows optional description field', async () => {
    const leagueWithDesc = await prisma.league?.create({
      data: {
        slug: 'test_with_desc',
        name: 'TEST_With Description',
        description: 'This is a test league',
        platform: 'sleeper',
        season: 2025,
        visibility: 'private',
      },
    });

    expect(leagueWithDesc?.description).toBe('This is a test league');

    const leagueWithoutDesc = await prisma.league?.create({
      data: {
        slug: 'test_without_desc',
        name: 'TEST_Without Description',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });

    expect(leagueWithoutDesc?.description).toBeNull();
  });

  test('League type matches frontend expectations', async () => {
    // Frontend expects: id, slug, name, description, teamCount, season, platform, avatarUrl, visibility, joinRule
    const league = await prisma.league?.create({
      data: {
        slug: 'test_type_contract',
        name: 'TEST_Type Contract',
        description: 'Test description',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
        avatarUrl: 'https://example.com/avatar.png',
        joinRule: 'auto_join',
      },
    });

    expect(league).toHaveProperty('id');
    expect(league).toHaveProperty('slug');
    expect(league).toHaveProperty('name');
    expect(league).toHaveProperty('description');
    expect(league).toHaveProperty('season');
    expect(league).toHaveProperty('platform');
    expect(league).toHaveProperty('visibility');
  });
});
