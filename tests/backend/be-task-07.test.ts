// tests/backend/be-task-07.test.ts
// Backend Test: Create Moments Table Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Moments Table Schema (task-07)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.moment?.deleteMany({ where: { content: { startsWith: 'TEST_' } } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('moments table exists with required fields', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_moment_author@example.com', name: 'TEST_Author' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_moments_league',
        name: 'TEST_Moments League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_This is a test moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });

    expect(moment).toBeDefined();
    if (moment) {
      expect(moment.id).toBeDefined();
      expect(moment.content).toBe('TEST_This is a test moment');
      expect(moment.authorId).toBe(user.id);
      expect(moment.leagueId).toBe(league!.id);
      expect(moment.type).toBe('post');
    }
  });

  test('supports moderation fields: isPinned, isHidden', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_author@example.com', name: 'TEST_ModAuthor' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_moments',
        name: 'TEST_Moderation Moments',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Moderation test moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
        isPinned: false,
        isHidden: false,
      },
    });

    expect(moment?.isPinned).toBe(false);
    expect(moment?.isHidden).toBe(false);

    // Test updating moderation flags
    const pinnedMoment = await prisma.moment?.update({
      where: { id: moment!.id },
      data: { isPinned: true },
    });

    expect(pinnedMoment?.isPinned).toBe(true);

    const hiddenMoment = await prisma.moment?.update({
      where: { id: moment!.id },
      data: { isHidden: true },
    });

    expect(hiddenMoment?.isHidden).toBe(true);
  });

  test('sets timestamps automatically', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_timestamp_author@example.com', name: 'TEST_TimestampAuthor' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_timestamp_moments',
        name: 'TEST_Timestamp Moments',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Timestamp test',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });

    expect(moment?.createdAt).toBeInstanceOf(Date);
    expect(moment?.updatedAt).toBeInstanceOf(Date);
  });

  test('Moment type matches frontend expectations', async () => {
    // Frontend expects Moment with reactions count, comments count, pinned badge
    const user = await prisma.user.create({
      data: { email: 'TEST_type_author@example.com', name: 'TEST_TypeAuthor' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_type_moments',
        name: 'TEST_Type Moments',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Type contract moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
        isPinned: true,
        isHidden: false,
      },
    });

    expect(moment).toHaveProperty('id');
    expect(moment).toHaveProperty('content');
    expect(moment).toHaveProperty('authorId');
    expect(moment).toHaveProperty('leagueId');
    expect(moment).toHaveProperty('type');
    expect(moment).toHaveProperty('isPinned');
    expect(moment).toHaveProperty('isHidden');
    expect(moment).toHaveProperty('createdAt');
    expect(moment).toHaveProperty('updatedAt');
  });
});
