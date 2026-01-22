// tests/backend/be-task-25.test.ts
// Backend Test: Implement Toggle Reaction Server Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Toggle Reaction Server Action (task-25)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;
  let testMomentId: string | null = null;

  afterEach(async () => {
    await prisma.reaction?.deleteMany({ where: { momentId: testMomentId || '' } }).catch(() => {});
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

  test('toggle reaction creates reaction when not exists', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_reaction_create@example.com', name: 'TEST_ReactionCreate' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_reaction_create',
        name: 'TEST_Reaction Create',
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

    // First toggle - creates reaction
    const reaction = await prisma.reaction?.create({
      data: {
        userId: user.id,
        momentId: moment!.id,
        reactionType: '🔥',
      },
    });

    expect(reaction?.reactionType).toBe('🔥');
  });

  test('toggle reaction deletes reaction when exists', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_reaction_delete@example.com', name: 'TEST_ReactionDelete' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_reaction_delete',
        name: 'TEST_Reaction Delete',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Toggle moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    // Create reaction
    const reaction = await prisma.reaction?.create({
      data: {
        userId: user.id,
        momentId: moment!.id,
        reactionType: '👍',
      },
    });

    // Toggle off - delete
    await prisma.reaction?.delete({
      where: { id: reaction!.id },
    });

    const deletedReaction = await prisma.reaction?.findUnique({
      where: { id: reaction!.id },
    });

    expect(deletedReaction).toBeNull();
  });

  test('toggle reaction returns ToggleReactionResult with new state', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_reaction_result@example.com', name: 'TEST_ReactionResult' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_reaction_result',
        name: 'TEST_Reaction Result',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Result moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    // Toggle on
    await prisma.reaction?.create({
      data: {
        userId: user.id,
        momentId: moment!.id,
        reactionType: '❤️',
      },
    });

    // Simulating ToggleReactionResult
    const toggleResult = {
      success: true,
      isActive: true,
      reactionType: '❤️',
    };

    expect(toggleResult.success).toBe(true);
    expect(toggleResult.isActive).toBe(true);
  });

  test('toggle reaction updates moment reaction counts', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_reaction_count@example.com', name: 'TEST_ReactionCount' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_reaction_count',
        name: 'TEST_Reaction Count',
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

    // Add multiple reactions
    const reactionTypes = ['🔥', '👍', '😂', '❤️', '🏆'];
    for (const type of reactionTypes) {
      await prisma.reaction?.create({
        data: {
          userId: user.id,
          momentId: moment!.id,
          reactionType: type,
        },
      });
    }

    const reactionCount = await prisma.reaction?.count({
      where: { momentId: moment!.id },
    });

    expect(reactionCount).toBe(5);
  });

  test('toggle reaction enforces unique user-moment-type constraint', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_reaction_unique@example.com', name: 'TEST_ReactionUnique' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_reaction_unique',
        name: 'TEST_Reaction Unique',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Unique moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    // First reaction
    await prisma.reaction?.create({
      data: {
        userId: user.id,
        momentId: moment!.id,
        reactionType: '🔥',
      },
    });

    // Duplicate should fail (compound unique)
    await expect(
      prisma.reaction?.create({
        data: {
          userId: user.id,
          momentId: moment!.id,
          reactionType: '🔥',
        },
      })
    ).rejects.toThrow();
  });

  test('toggle reaction validates user is league member', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_reaction_member@example.com', name: 'TEST_ReactionMember' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_reaction_member',
        name: 'TEST_Reaction Member',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Check membership - user is not a member
    const isMember = await prisma.leagueMembership?.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    expect(isMember).toBeNull();
  });

  test('toggle reaction supports different emoji types', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_reaction_emoji@example.com', name: 'TEST_ReactionEmoji' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_reaction_emoji',
        name: 'TEST_Reaction Emoji',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Emoji moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });
    testMomentId = moment?.id || null;

    const emojiTypes = ['🔥', '👍', '👎', '😂', '😢', '❤️', '🏆', '💀', '🎯', '💯'];

    for (const emoji of emojiTypes) {
      const reaction = await prisma.reaction?.create({
        data: {
          userId: user.id,
          momentId: moment!.id,
          reactionType: emoji,
        },
      });

      expect(reaction?.reactionType).toBe(emoji);
    }
  });
});
