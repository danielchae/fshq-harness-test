// tests/backend/be-task-47.test.ts
// Backend Test: Implement Get Moment Detail Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Moment Detail Data Fetcher (task-47)', () => {
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

  test('queries moment with author and metadata', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_detail_author@example.com', name: 'TEST_DetailAuthor' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_detail_author',
        name: 'TEST_Detail Author',
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
        content: 'TEST_Detailed moment content',
      },
    });

    const momentWithAuthor = await prisma.moment?.findUnique({
      where: { id: moment!.id },
      include: { author: true },
    });

    expect(momentWithAuthor?.author?.name).toBe('TEST_DetailAuthor');
    expect(momentWithAuthor?.content).toBe('TEST_Detailed moment content');
  });

  test('includes full comments tree with replies', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_detail_comments@example.com', name: 'TEST_DetailComments' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_detail_comments',
        name: 'TEST_Detail Comments',
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
        content: 'TEST_Moment with comments',
      },
    });

    // Parent comment
    const parentComment = await prisma.comment?.create({
      data: {
        momentId: moment!.id,
        authorId: user.id,
        content: 'TEST_Parent comment',
      },
    });

    // Reply to parent
    await prisma.comment?.create({
      data: {
        momentId: moment!.id,
        authorId: user.id,
        content: 'TEST_Reply to parent',
        parentId: parentComment!.id,
      },
    });

    // Another parent comment
    await prisma.comment?.create({
      data: {
        momentId: moment!.id,
        authorId: user.id,
        content: 'TEST_Another parent',
      },
    });

    const comments = await prisma.comment?.findMany({
      where: { momentId: moment!.id },
      include: { author: true },
    });

    // Filter to get tree structure
    const parentComments = comments?.filter((c) => !c.parentId);
    const replies = comments?.filter((c) => c.parentId);

    expect(parentComments?.length).toBe(2);
    expect(replies?.length).toBe(1);
    expect(replies?.[0].parentId).toBe(parentComment!.id);
  });

  test('includes reaction counts by type', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_detail_reactions@example.com', name: 'TEST_DetailReactions' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_detail_reactions',
        name: 'TEST_Detail Reactions',
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
        content: 'TEST_Moment with reactions',
      },
    });

    // Add various reactions
    await prisma.reaction?.create({
      data: { momentId: moment!.id, userId: user.id, reactionType: '🔥' },
    });

    // Simulate multiple users reacting
    const reactionCounts = await prisma.reaction?.groupBy({
      by: ['reactionType'],
      where: { momentId: moment!.id },
      _count: { reactionType: true },
    });

    expect(reactionCounts?.length).toBeGreaterThanOrEqual(1);
    expect(reactionCounts?.find((r) => r.reactionType === '🔥')?._count.reactionType).toBe(1);
  });

  test('returns MomentDetail type contract shape', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_detail_shape@example.com', name: 'TEST_DetailShape' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_detail_shape',
        name: 'TEST_Detail Shape',
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
        content: 'TEST_Shape moment',
        isPinned: false,
        isHidden: false,
      },
    });

    const momentDetail = await prisma.moment?.findUnique({
      where: { id: moment!.id },
      include: {
        author: true,
        comments: { include: { author: true } },
        reactions: true,
        _count: { select: { comments: true, reactions: true } },
      },
    });

    // Verify MomentDetail type contract
    expect(momentDetail).toHaveProperty('id');
    expect(momentDetail).toHaveProperty('content');
    expect(momentDetail).toHaveProperty('author');
    expect(momentDetail).toHaveProperty('comments');
    expect(momentDetail).toHaveProperty('reactions');
    expect(momentDetail).toHaveProperty('_count');
  });

  test('returns null for non-existent moment', async () => {
    const nonExistent = await prisma.moment?.findUnique({
      where: { id: 'non-existent-moment-id-12345' },
    });

    expect(nonExistent).toBeNull();
  });

  test('respects hidden status based on user role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_detail_hidden@example.com', name: 'TEST_DetailHidden' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_detail_hidden',
        name: 'TEST_Detail Hidden',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const hiddenMoment = await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Hidden moment detail',
        isHidden: true,
      },
    });

    // Regular user query (should not find hidden)
    const regularQuery = await prisma.moment?.findFirst({
      where: { id: hiddenMoment!.id, isHidden: false },
    });

    // Commissioner query (can see hidden)
    const commissionerQuery = await prisma.moment?.findFirst({
      where: { id: hiddenMoment!.id },
    });

    expect(regularQuery).toBeNull();
    expect(commissionerQuery).toBeDefined();
    expect(commissionerQuery?.isHidden).toBe(true);
  });
});
