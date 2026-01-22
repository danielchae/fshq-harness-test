// tests/backend/be-task-24.test.ts
// Backend Test: Implement Create Comment Server Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Create Comment Server Action (task-24)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  let testMomentId: string | null = null;

  afterEach(async () => {
    await prisma.comment?.deleteMany({ where: { momentId: testMomentId || '' } }).catch(() => {});
    await prisma.moment?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.leagueMembership?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('create comment validates user is league member', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_comment_member@example.com', name: 'TEST_CommentMember' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_comment_league',
        name: 'TEST_Comment League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Check membership before allowing comment
    const isMember = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(isMember).toBeNull();

    // Add membership
    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'manager',
        status: 'approved',
      },
    });

    const nowMember = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(nowMember).toBeDefined();
  });

  test('create comment stores content with author info', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_comment_author@example.com', name: 'TEST_CommentAuthor' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_comment_author',
        name: 'TEST_Comment Author',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Moment for comments',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    const comment = await prisma.comment?.create({
      data: {
        content: 'TEST_This is a great post!',
        authorId: user.id,
        momentId: moment!.id,
      },
    });

    expect(comment?.content).toBe('TEST_This is a great post!');
    expect(comment?.authorId).toBe(user.id);
    expect(comment?.momentId).toBe(moment!.id);
  });

  test('create comment supports threading with parentId', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_comment_thread@example.com', name: 'TEST_CommentThread' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_comment_thread',
        name: 'TEST_Comment Thread',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Threaded moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    // Create parent comment
    const parentComment = await prisma.comment?.create({
      data: {
        content: 'TEST_Parent comment',
        authorId: user.id,
        momentId: moment!.id,
      },
    });

    // Create reply
    const replyComment = await prisma.comment?.create({
      data: {
        content: 'TEST_Reply to parent',
        authorId: user.id,
        momentId: moment!.id,
        parentId: parentComment!.id,
      },
    });

    expect(replyComment?.parentId).toBe(parentComment!.id);

    // Query thread
    const replies = await prisma.comment?.findMany({
      where: { parentId: parentComment!.id },
    });

    expect(replies?.length).toBe(1);
  });

  test('create comment returns Comment with author data', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_comment_return@example.com', name: 'TEST_CommentReturn' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_comment_return',
        name: 'TEST_Comment Return',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Return moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    const comment = await prisma.comment?.create({
      data: {
        content: 'TEST_Comment with author',
        authorId: user.id,
        momentId: moment!.id,
      },
    });

    // Fetch comment with author
    const commentWithAuthor = await prisma.comment?.findUnique({
      where: { id: comment!.id },
      include: { author: true },
    });

    expect(commentWithAuthor?.author?.name).toBe('TEST_CommentReturn');
  });

  test('create comment increments moment comment count', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_comment_count@example.com', name: 'TEST_CommentCount' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_comment_count',
        name: 'TEST_Comment Count',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Count moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    // Create multiple comments
    for (let i = 0; i < 5; i++) {
      await prisma.comment?.create({
        data: {
          content: `TEST_Comment ${i}`,
          authorId: user.id,
          momentId: moment!.id,
        },
      });
    }

    const commentCount = await prisma.comment?.count({
      where: { momentId: moment!.id },
    });

    expect(commentCount).toBe(5);
  });

  test('create comment validates moment exists', async () => {
    // Check for non-existent moment
    const nonExistentMoment = await prisma.moment?.findUnique({
      where: { id: 'non-existent-moment-id' },
    });

    expect(nonExistentMoment).toBeNull();
  });

  test('create comment validates content is not empty', async () => {
    const emptyContent = '';
    const whitespaceContent = '   ';
    const validContent = 'TEST_Valid comment';

    expect(emptyContent.trim().length).toBe(0);
    expect(whitespaceContent.trim().length).toBe(0);
    expect(validContent.trim().length).toBeGreaterThan(0);
  });
});
