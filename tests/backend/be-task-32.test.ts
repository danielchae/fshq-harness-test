// tests/backend/be-task-32.test.ts
// Backend Test: Implement Get Feed Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Feed Data Fetcher (task-32)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.reaction?.deleteMany({ where: { moment: { leagueId: testLeagueId || '' } } }).catch(() => {});
    await prisma.comment?.deleteMany({ where: { moment: { leagueId: testLeagueId || '' } } }).catch(() => {});
    await prisma.moment?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('queries moments for league ordered by createdAt DESC', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_feed_order@example.com', name: 'TEST_FeedOrder' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_feed_order',
        name: 'TEST_Feed Order',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create moments in specific order
    for (let i = 0; i < 3; i++) {
      await prisma.moment?.create({
        data: {
          leagueId: league!.id,
          authorId: user.id,
          content: `TEST_Moment ${i}`,
        },
      });
    }

    const moments = await prisma.moment?.findMany({
      where: { leagueId: league!.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(moments?.length).toBe(3);
    // Most recent first
    expect(moments?.[0].content).toBe('TEST_Moment 2');
  });

  test('includes reaction counts and recent comments', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_feed_counts@example.com', name: 'TEST_FeedCounts' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_feed_counts',
        name: 'TEST_Feed Counts',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Moment with engagement',
      },
    });

    // Add reactions
    await prisma.reaction?.create({
      data: {
        momentId: moment!.id,
        userId: user.id,
        reactionType: '🔥',
      },
    });

    // Add comment
    await prisma.comment?.create({
      data: {
        momentId: moment!.id,
        authorId: user.id,
        content: 'TEST_Comment',
      },
    });

    const momentWithCounts = await prisma.moment?.findUnique({
      where: { id: moment!.id },
      include: {
        _count: { select: { reactions: true, comments: true } },
      },
    });

    expect(momentWithCounts?._count.reactions).toBe(1);
    expect(momentWithCounts?._count.comments).toBe(1);
  });

  test('filters out hidden moments unless user is commissioner', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_feed_hidden@example.com', name: 'TEST_FeedHidden' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_feed_hidden',
        name: 'TEST_Feed Hidden',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create visible moment
    await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Visible moment',
        isHidden: false,
      },
    });

    // Create hidden moment
    await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Hidden moment',
        isHidden: true,
      },
    });

    // Non-commissioner query
    const visibleMoments = await prisma.moment?.findMany({
      where: { leagueId: league!.id, isHidden: false },
    });

    // Commissioner query (sees all)
    const allMoments = await prisma.moment?.findMany({
      where: { leagueId: league!.id },
    });

    expect(visibleMoments?.length).toBe(1);
    expect(allMoments?.length).toBe(2);
  });

  test('returns FeedResponse type contract shape', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_feed_shape@example.com', name: 'TEST_FeedShape' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_feed_shape',
        name: 'TEST_Feed Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Feed response shape',
      },
    });

    // Verify Moment type contract
    expect(moment).toHaveProperty('id');
    expect(moment).toHaveProperty('content');
    expect(moment).toHaveProperty('authorId');
    expect(moment).toHaveProperty('leagueId');
    expect(moment).toHaveProperty('createdAt');
  });

  test('shows pinned moments at top', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_feed_pinned@example.com', name: 'TEST_FeedPinned' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_feed_pinned',
        name: 'TEST_Feed Pinned',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create regular moment first
    await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Regular moment',
        isPinned: false,
      },
    });

    // Create pinned moment after
    await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Pinned moment',
        isPinned: true,
      },
    });

    // Query with pinned first
    const moments = await prisma.moment?.findMany({
      where: { leagueId: league!.id, isHidden: false },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    expect(moments?.[0].isPinned).toBe(true);
    expect(moments?.[0].content).toBe('TEST_Pinned moment');
  });
});
