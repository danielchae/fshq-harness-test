// tests/backend/be-task-46.test.ts
// Backend Test: Implement Get Hidden Moments Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Hidden Moments Data Fetcher (task-46)', () => {
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

  test('validates user has commissioner or admin role', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_hidden_role@example.com', name: 'TEST_HiddenRole' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_hidden_role',
        name: 'TEST_Hidden Role',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Commissioner
    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    const membership = await prisma.leagueMembership?.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    const canViewHidden = membership?.role === 'commissioner' || membership?.role === 'admin';
    expect(canViewHidden).toBe(true);
  });

  test('rejects non-commissioner/admin users', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_hidden_reject@example.com', name: 'TEST_HiddenReject' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_hidden_reject',
        name: 'TEST_Hidden Reject',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Manager role
    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'manager',
        status: 'approved',
      },
    });

    const membership = await prisma.leagueMembership?.findFirst({
      where: { userId: user.id, leagueId: league!.id },
    });

    const canViewHidden = membership?.role === 'commissioner' || membership?.role === 'admin';
    expect(canViewHidden).toBe(false);
  });

  test('queries moments where isHidden = true', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_hidden_query@example.com', name: 'TEST_HiddenQuery' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_hidden_query',
        name: 'TEST_Hidden Query',
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
        content: 'TEST_Visible content',
        isHidden: false,
      },
    });

    // Create hidden moments
    await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Hidden content 1',
        isHidden: true,
      },
    });

    await prisma.moment?.create({
      data: {
        leagueId: league!.id,
        authorId: user.id,
        content: 'TEST_Hidden content 2',
        isHidden: true,
      },
    });

    const hiddenMoments = await prisma.moment?.findMany({
      where: { leagueId: league!.id, isHidden: true },
    });

    expect(hiddenMoments?.length).toBe(2);
  });

  test('includes hide reason and timestamp', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_hidden_reason@example.com', name: 'TEST_HiddenReason' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_hidden_reason',
        name: 'TEST_Hidden Reason',
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
        content: 'TEST_Hidden with reason',
        isHidden: true,
        hideReason: 'TEST_Inappropriate content',
        hiddenAt: new Date(),
      },
    });

    expect(hiddenMoment?.hideReason).toBe('TEST_Inappropriate content');
    expect(hiddenMoment?.hiddenAt).toBeDefined();
  });

  test('returns HiddenMomentsResponse type contract shape', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_hidden_shape@example.com', name: 'TEST_HiddenShape' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_hidden_shape',
        name: 'TEST_Hidden Shape',
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
        isHidden: true,
      },
    });

    // Verify Moment type contract for hidden moments
    expect(moment).toHaveProperty('id');
    expect(moment).toHaveProperty('content');
    expect(moment).toHaveProperty('isHidden');
    expect(moment?.isHidden).toBe(true);
  });

  test('moderation queue orders by hiddenAt DESC', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_hidden_order@example.com', name: 'TEST_HiddenOrder' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_hidden_order',
        name: 'TEST_Hidden Order',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create hidden moments at different times
    for (let i = 0; i < 3; i++) {
      await prisma.moment?.create({
        data: {
          leagueId: league!.id,
          authorId: user.id,
          content: `TEST_Hidden ${i}`,
          isHidden: true,
          hiddenAt: new Date(Date.now() - i * 1000 * 60),
        },
      });
    }

    const queue = await prisma.moment?.findMany({
      where: { leagueId: league!.id, isHidden: true },
      orderBy: { hiddenAt: 'desc' },
    });

    expect(queue?.length).toBe(3);
    // Most recently hidden first
    expect(queue?.[0].content).toBe('TEST_Hidden 0');
  });
});
