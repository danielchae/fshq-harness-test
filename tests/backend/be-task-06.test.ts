// tests/backend/be-task-06.test.ts
// Backend Test: Create URL Slugs Table Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create URL Slugs Table Schema (task-06)', () => {
  afterEach(async () => {
    await prisma.slug?.deleteMany({ where: { slug: { startsWith: 'test_' } } }).catch(() => {});
  });

  test('slugs table exists with required fields', async () => {
    const slug = await prisma.slug?.create({
      data: {
        slug: 'test_url_slug',
        entityType: 'league',
        entityId: 'test-entity-123',
      },
    });

    expect(slug).toBeDefined();
    if (slug) {
      expect(slug.id).toBeDefined();
      expect(slug.slug).toBe('test_url_slug');
      expect(slug.entityType).toBe('league');
      expect(slug.entityId).toBe('test-entity-123');
    }
  });

  test('enforces unique constraint on slug column', async () => {
    await prisma.slug?.create({
      data: {
        slug: 'test_unique_url',
        entityType: 'league',
        entityId: 'entity-1',
      },
    });

    await expect(
      prisma.slug?.create({
        data: {
          slug: 'test_unique_url',
          entityType: 'league',
          entityId: 'entity-2',
        },
      })
    ).rejects.toThrow(/unique/i);
  });

  test('supports different entity types', async () => {
    const leagueSlug = await prisma.slug?.create({
      data: {
        slug: 'test_league_entity',
        entityType: 'league',
        entityId: 'league-123',
      },
    });

    const teamSlug = await prisma.slug?.create({
      data: {
        slug: 'test_team_entity',
        entityType: 'team',
        entityId: 'team-456',
      },
    });

    expect(leagueSlug?.entityType).toBe('league');
    expect(teamSlug?.entityType).toBe('team');
  });

  test('allows lookup by slug', async () => {
    await prisma.slug?.create({
      data: {
        slug: 'test_lookup_slug',
        entityType: 'league',
        entityId: 'league-lookup-123',
      },
    });

    const found = await prisma.slug?.findUnique({
      where: { slug: 'test_lookup_slug' },
    });

    expect(found).toBeDefined();
    expect(found?.entityId).toBe('league-lookup-123');
  });

  test('allows lookup by entityType and entityId', async () => {
    await prisma.slug?.create({
      data: {
        slug: 'test_entity_lookup',
        entityType: 'league',
        entityId: 'specific-entity-id',
      },
    });

    const found = await prisma.slug?.findFirst({
      where: {
        entityType: 'league',
        entityId: 'specific-entity-id',
      },
    });

    expect(found).toBeDefined();
    expect(found?.slug).toBe('test_entity_lookup');
  });
});
