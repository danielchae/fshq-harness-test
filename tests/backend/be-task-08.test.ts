// tests/backend/be-task-08.test.ts
// Backend Test: Create Posts, Comments, and Reactions Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Posts, Comments, and Reactions Schema (task-08)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  let testMomentId: string | null = null;

  afterEach(async () => {
    if (testMomentId) {
      await prisma.comment?.deleteMany({ where: { momentId: testMomentId } }).catch(() => {});
      await prisma.reaction?.deleteMany({ where: { momentId: testMomentId } }).catch(() => {});
      await prisma.moment?.delete({ where: { id: testMomentId } }).catch(() => {});
      testMomentId = null;
    }
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('comments table exists with required fields', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_comment_user@example.com', name: 'TEST_Commenter' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_comments_league',
        name: 'TEST_Comments League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Parent moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    const comment = await prisma.comment?.create({
      data: {
        content: 'TEST_This is a comment',
        authorId: user.id,
        momentId: moment!.id,
      },
    });

    expect(comment).toBeDefined();
    if (comment) {
      expect(comment.id).toBeDefined();
      expect(comment.content).toBe('TEST_This is a comment');
      expect(comment.authorId).toBe(user.id);
      expect(comment.momentId).toBe(moment!.id);
    }
  });

  test('comments support threading with parentId', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_thread_user@example.com', name: 'TEST_ThreadUser' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_thread_league',
        name: 'TEST_Thread League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Thread parent moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    const parentComment = await prisma.comment?.create({
      data: {
        content: 'TEST_Parent comment',
        authorId: user.id,
        momentId: moment!.id,
      },
    });

    const replyComment = await prisma.comment?.create({
      data: {
        content: 'TEST_Reply comment',
        authorId: user.id,
        momentId: moment!.id,
        parentId: parentComment!.id,
      },
    });

    expect(replyComment?.parentId).toBe(parentComment!.id);
  });

  test('reactions table exists with required fields', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_reaction_user@example.com', name: 'TEST_Reactor' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_reactions_league',
        name: 'TEST_Reactions League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Reaction moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    const reaction = await prisma.reaction?.create({
      data: {
        userId: user.id,
        momentId: moment!.id,
        reactionType: '👍',
      },
    });

    expect(reaction).toBeDefined();
    if (reaction) {
      expect(reaction.id).toBeDefined();
      expect(reaction.userId).toBe(user.id);
      expect(reaction.momentId).toBe(moment!.id);
      expect(reaction.reactionType).toBe('👍');
    }
  });

  test('enforces compound unique constraint on reactions (userId + momentId + reactionType)', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_unique_react@example.com', name: 'TEST_UniqueReactor' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_unique_reactions',
        name: 'TEST_Unique Reactions',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Unique reaction moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    await prisma.reaction?.create({
      data: {
        userId: user.id,
        momentId: moment!.id,
        reactionType: '🔥',
      },
    });

    // Attempt duplicate reaction
    await expect(
      prisma.reaction?.create({
        data: {
          userId: user.id,
          momentId: moment!.id,
          reactionType: '🔥',
        },
      })
    ).rejects.toThrow(/unique/i);
  });

  test('Comment type matches frontend expectations', async () => {
    // Frontend expects Comment with id, content, author, createdAt, replies
    const user = await prisma.user.create({
      data: { email: 'TEST_type_comment@example.com', name: 'TEST_TypeComment' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_type_comment_league',
        name: 'TEST_Type Comment League',
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
      },
    });
    testMomentId = moment?.id || null;

    const comment = await prisma.comment?.create({
      data: {
        content: 'TEST_Type contract comment',
        authorId: user.id,
        momentId: moment!.id,
      },
    });

    expect(comment).toHaveProperty('id');
    expect(comment).toHaveProperty('content');
    expect(comment).toHaveProperty('authorId');
    expect(comment).toHaveProperty('createdAt');
  });
});
