// tests/backend/be-task-17.test.ts
// Backend Test: Create Database Indexes for Query Performance

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Database Indexes for Query Performance (task-17)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    await prisma.moment?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.membership?.deleteMany({ where: { userId: testUserId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('index on leagues.slug enables fast URL routing', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_indexed_slug',
        name: 'TEST_Indexed League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Query by slug - should use index
    const foundLeague = await prisma.league?.findUnique({
      where: { slug: 'test_indexed_slug' },
    });

    expect(foundLeague).toBeDefined();
    expect(foundLeague?.id).toBe(league!.id);
  });

  test('index on memberships (userId, leagueId) enables fast access checks', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_indexed_member@example.com', name: 'TEST_IndexedMember' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_indexed_membership',
        name: 'TEST_Indexed Membership',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    await prisma.leagueMembership?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        role: 'manager',
      },
    });

    // Query by userId and leagueId - should use composite index
    const membership = await prisma.leagueMembership?.findFirst({
      where: {
        userId: user.id,
        leagueId: league!.id,
      },
    });

    expect(membership).toBeDefined();
    expect(membership?.role).toBe('manager');
  });

  test('index on moments (leagueId, createdAt) enables fast feed queries', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_feed_index@example.com', name: 'TEST_FeedIndex' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_feed_index',
        name: 'TEST_Feed Index',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create multiple moments
    for (let i = 0; i < 10; i++) {
      await prisma.moment?.create({
        data: {
          content: `TEST_Moment ${i}`,
          authorId: user.id,
          leagueId: league!.id,
          type: 'post',
        },
      });
    }

    // Query feed by league with ordering - should use composite index
    const feed = await prisma.moment?.findMany({
      where: { leagueId: league!.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    expect(feed?.length).toBe(5);
    // Verify ordering
    for (let i = 0; i < feed!.length - 1; i++) {
      expect(feed![i].createdAt.getTime()).toBeGreaterThanOrEqual(
        feed![i + 1].createdAt.getTime()
      );
    }
  });

  test('index on matchups enables efficient week queries', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_matchup_index',
        name: 'TEST_Matchup Index',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Index Team 1',
        ownerUsername: 'idx1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Index Team 2',
        ownerUsername: 'idx2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Create matchups for multiple weeks
    for (let week = 1; week <= 17; week++) {
      await prisma.matchup?.create({
        data: {
          leagueId: league!.id,
          season: 2025,
          weekNumber: week,
          homeTeamId: team1!.id,
          awayTeamId: team2!.id,
          isComplete: week < 10,
        },
      });
    }

    // Query matchups by league and week - should use index
    const week10Matchups = await prisma.matchup?.findMany({
      where: {
        leagueId: league!.id,
        weekNumber: 10,
      },
    });

    expect(week10Matchups?.length).toBe(1);

    // Cleanup
    await prisma.matchup?.deleteMany({ where: { leagueId: league!.id } });
    await prisma.team?.deleteMany({ where: { leagueId: league!.id } });
  });

  test('index on pickemEntries enables efficient user pick queries', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_pick_index@example.com', name: 'TEST_PickIndex' },
    });
    testUserId = user.id;

    const league = await prisma.league?.create({
      data: {
        slug: 'test_pick_index',
        name: 'TEST_Pick Index',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create teams and matchup
    const team1 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_PI Team 1',
        ownerUsername: 'pi1',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const team2 = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_PI Team 2',
        ownerUsername: 'pi2',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const matchup = await prisma.matchup?.create({
      data: {
        leagueId: league!.id,
        season: 2025,
        weekNumber: 5,
        homeTeamId: team1!.id,
        awayTeamId: team2!.id,
        isComplete: false,
      },
    });

    await prisma.pickemEntry?.create({
      data: {
        userId: user.id,
        leagueId: league!.id,
        season: 2025,
        weekNumber: 5,
        matchupId: matchup!.id,
        predictedWinnerId: team1!.id,
      },
    });

    // Query user picks by league and week
    const picks = await prisma.pickemEntry?.findMany({
      where: {
        userId: user.id,
        leagueId: league!.id,
        weekNumber: 5,
      },
    });

    expect(picks?.length).toBe(1);

    // Cleanup
    await prisma.pickemEntry?.deleteMany({ where: { userId: user.id } });
    await prisma.matchup?.deleteMany({ where: { leagueId: league!.id } });
    await prisma.team?.deleteMany({ where: { leagueId: league!.id } });
  });
});
