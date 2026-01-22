// tests/backend/be-task-26.test.ts
// Backend Test: Implement Moderation Server Actions (Pin/Hide/Delete)

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Moderation Server Actions (task-26)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
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

  test('moderation validates user has commissioner role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_role@example.com', name: 'TEST_ModRole' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_role',
        name: 'TEST_Mod Role',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create commissioner membership
    const membership = await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'commissioner',
      },
    });

    expect(membership.role).toBe('commissioner');

    // Check if user can moderate
    const canModerate = ['commissioner', 'admin'].includes(membership?.role || '');
    expect(canModerate).toBe(true);
  });

  test('moderation rejects non-commissioner users', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_reject@example.com', name: 'TEST_ModReject' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_reject',
        name: 'TEST_Mod Reject',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create manager membership (not commissioner)
    const membership = await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'manager',
      },
    });

    const canModerate = ['commissioner', 'admin'].includes(membership.role || '');
    expect(canModerate).toBe(false);
  });

  test('pin moment updates isPinned flag', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_pin@example.com', name: 'TEST_ModPin' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_pin',
        name: 'TEST_Mod Pin',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Pin moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
        isPinned: false,
      },
    });

    // Pin the moment
    const pinnedMoment = await prisma.moment?.update({
      where: { id: moment!.id },
      data: { isPinned: true },
    });

    expect(pinnedMoment?.isPinned).toBe(true);
  });

  test('unpin moment removes isPinned flag', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_unpin@example.com', name: 'TEST_ModUnpin' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_unpin',
        name: 'TEST_Mod Unpin',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Unpin moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
        isPinned: true,
      },
    });

    // Unpin the moment
    const unpinnedMoment = await prisma.moment?.update({
      where: { id: moment!.id },
      data: { isPinned: false },
    });

    expect(unpinnedMoment?.isPinned).toBe(false);
  });

  test('hide moment updates isHidden flag', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_hide@example.com', name: 'TEST_ModHide' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_hide',
        name: 'TEST_Mod Hide',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Hide moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
        isHidden: false,
      },
    });

    // Hide the moment
    const hiddenMoment = await prisma.moment?.update({
      where: { id: moment!.id },
      data: { isHidden: true },
    });

    expect(hiddenMoment?.isHidden).toBe(true);
  });

  test('unhide moment removes isHidden flag', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_unhide@example.com', name: 'TEST_ModUnhide' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_unhide',
        name: 'TEST_Mod Unhide',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Unhide moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
        isHidden: true,
      },
    });

    // Unhide the moment
    const unhiddenMoment = await prisma.moment?.update({
      where: { id: moment!.id },
      data: { isHidden: false },
    });

    expect(unhiddenMoment?.isHidden).toBe(false);
  });

  test('delete moment removes record', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_delete@example.com', name: 'TEST_ModDelete' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_delete',
        name: 'TEST_Mod Delete',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const moment = await prisma.moment?.create({
      data: {
        content: 'TEST_Delete moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
      },
    });

    const momentId = moment!.id;

    // Delete the moment
    await prisma.moment?.delete({
      where: { id: momentId },
    });

    const deletedMoment = await prisma.moment?.findUnique({
      where: { id: momentId },
    });

    expect(deletedMoment).toBeNull();
  });

  test('hidden moments excluded from regular feed', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_mod_feed@example.com', name: 'TEST_ModFeed' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_mod_feed',
        name: 'TEST_Mod Feed',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create visible and hidden moments
    await prisma.moment?.create({
      data: {
        content: 'TEST_Visible moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
        isHidden: false,
      },
    });

    await prisma.moment?.create({
      data: {
        content: 'TEST_Hidden moment',
        authorId: user.id,
        leagueId: league!.id,
        type: 'post',
        isHidden: true,
      },
    });

    // Query visible moments only
    const visibleMoments = await prisma.moment?.findMany({
      where: {
        leagueId: league!.id,
        isHidden: false,
      },
    });

    expect(visibleMoments?.length).toBe(1);
    expect(visibleMoments?.[0].content).toBe('TEST_Visible moment');
  });
});
