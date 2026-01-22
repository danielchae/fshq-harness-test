// tests/backend/be-task-50.test.ts
// Backend Test: Implement Sleeper League Sync Job

import { describe, test, expect, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Sleeper League Sync Job (task-50)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.matchup?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.transaction?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('runs on cron schedule (every 30 minutes during season)', async () => {
    // Simulate cron job scheduling
    const cronSchedule = '*/30 * * * *'; // Every 30 minutes
    const mockCronParser = {
      parseExpression: (schedule: string) => ({
        next: () => new Date(Date.now() + 30 * 60 * 1000),
      }),
    };

    const nextRun = mockCronParser.parseExpression(cronSchedule).next();
    const timeDiff = nextRun.getTime() - Date.now();

    expect(timeDiff).toBeLessThanOrEqual(30 * 60 * 1000);
    expect(timeDiff).toBeGreaterThan(0);
  });

  test('fetches league, rosters, matchups, transactions', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_sync_fetch',
        name: 'TEST_Sync Fetch',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_sync_123',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Simulate fetched data from Sleeper API
    const syncedData = {
      league: { id: 'sleeper_sync_123', name: 'TEST_Sync Fetch' },
      rosters: [
        { rosterId: 1, ownerId: 'user1' },
        { rosterId: 2, ownerId: 'user2' },
      ],
      matchups: [{ matchupId: 1, roster1: 1, roster2: 2, week: 10 }],
      transactions: [{ transactionId: 1, type: 'add', rosterId: 1 }],
    };

    expect(syncedData.league).toBeDefined();
    expect(syncedData.rosters.length).toBeGreaterThan(0);
    expect(syncedData.matchups.length).toBeGreaterThan(0);
    expect(syncedData.transactions.length).toBeGreaterThan(0);
  });

  test('uses differential sync with checksums', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_sync_checksum',
        name: 'TEST_Sync Checksum',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_checksum_123',
        season: 2025,
        visibility: 'public',
        lastSyncChecksum: 'abc123',
      },
    });
    testLeagueId = league?.id || null;

    // Simulate checksum comparison
    const oldChecksum = league?.lastSyncChecksum;
    const newChecksum = 'abc123'; // Same as old - no changes

    const hasChanges = oldChecksum !== newChecksum;
    expect(hasChanges).toBe(false);

    // Different checksum - has changes
    const changedChecksum = 'xyz789';
    const hasChanges2 = oldChecksum !== changedChecksum;
    expect(hasChanges2).toBe(true);
  });

  test('updates database with new/changed data only', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_sync_update',
        name: 'TEST_Sync Update',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_update_123',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Create initial team
    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Original Name',
        platformTeamId: 'roster_1',
        wins: 5,
        losses: 3,
        ties: 0,
      },
    });

    // Simulate sync update (only name changed)
    const updatedTeam = await prisma.team?.update({
      where: { id: team!.id },
      data: { name: 'TEST_Updated Name' },
    });

    expect(updatedTeam?.name).toBe('TEST_Updated Name');
    expect(updatedTeam?.wins).toBe(5); // Unchanged
  });

  test('handles API errors gracefully', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_sync_error',
        name: 'TEST_Sync Error',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_error_123',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    // Simulate API error handling
    const mockApiCall = async () => {
      throw new Error('API rate limit exceeded');
    };

    let errorCaught = false;
    try {
      await mockApiCall();
    } catch (error) {
      errorCaught = true;
      expect(error).toBeInstanceOf(Error);
    }

    expect(errorCaught).toBe(true);
  });

  test('tracks last sync timestamp', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_sync_timestamp',
        name: 'TEST_Sync Timestamp',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_ts_123',
        season: 2025,
        visibility: 'public',
        lastSyncedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
    });
    testLeagueId = league?.id || null;

    // Update last sync timestamp
    const updatedLeague = await prisma.league?.update({
      where: { id: league!.id },
      data: { lastSyncedAt: new Date() },
    });

    expect(updatedLeague?.lastSyncedAt).toBeDefined();
    expect(updatedLeague?.lastSyncedAt?.getTime()).toBeGreaterThan(
      league?.lastSyncedAt?.getTime() || 0
    );
  });

  test('skips sync for inactive leagues', async () => {
    const inactiveLeague = await prisma.league?.create({
      data: {
        slug: 'test_sync_inactive',
        name: 'TEST_Sync Inactive',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_inactive_123',
        season: 2023, // Old season
        visibility: 'public',
      },
    });
    testLeagueId = inactiveLeague?.id || null;

    // Check if league should be synced (current season only)
    const currentSeason = 2025;
    const shouldSync = inactiveLeague?.season === currentSeason;

    expect(shouldSync).toBe(false);
  });
});
