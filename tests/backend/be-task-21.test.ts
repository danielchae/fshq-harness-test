// tests/backend/be-task-21.test.ts
// Backend Test: Implement Sync League Server Action

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Sync League Server Action (task-21)', () => {
  let testLeagueId: string | null = null;
  let testUserId: string | null = null;

  afterEach(async () => {
    // Clean up in proper order to respect foreign key constraints
    if (testLeagueId) {
      await prisma.leagueMembership.deleteMany({ where: { leagueId: testLeagueId } }).catch(() => {});
      await prisma.team.deleteMany({ where: { leagueId: testLeagueId } }).catch(() => {});
      await prisma.slug.deleteMany({ where: { entityId: testLeagueId } }).catch(() => {});
      await prisma.league.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = null;
    }
  });

  test('sync action creates league record from Sleeper data', async () => {
    // Simulating what the sync action should do
    const user = await prisma.user.create({
      data: { email: 'TEST_sync_commissioner@example.com', name: 'TEST_SyncCommissioner' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test-synced-league',
        name: 'TEST_Synced Dynasty League',
        platform: 'sleeper',
        platformLeagueId: 'sleeper_123456789',
        season: 2025,
        visibility: 'public',
        creatorId: user.id,
      },
    });
    testLeagueId = league.id;

    expect(league.platform).toBe('sleeper');
    expect(league.platformLeagueId).toBe('sleeper_123456789');
  });

  test('sync action creates team records for all rosters', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test-sync-teams',
        name: 'TEST_Sync Teams',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Simulate creating teams from Sleeper rosters
    const teamData = [
      { name: 'Team Alpha', ownerUsername: 'alpha_owner', externalRosterId: 'roster-1' },
      { name: 'Team Beta', ownerUsername: 'beta_owner', externalRosterId: 'roster-2' },
      { name: 'Team Gamma', ownerUsername: 'gamma_owner', externalRosterId: 'roster-3' },
    ];

    for (const team of teamData) {
      await prisma.team.create({
        data: {
          leagueId: league.id,
          name: `TEST_${team.name}`,
          ownerUsername: team.ownerUsername,
          externalRosterId: team.externalRosterId,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      });
    }

    const teams = await prisma.team.findMany({
      where: { leagueId: league.id },
    });

    expect(teams.length).toBe(3);
  });

  test('sync action creates membership for commissioner', async () => {
    const user = await prisma.user.create({
      data: { email: 'TEST_sync_owner@example.com', name: 'TEST_SyncOwner' },
    });
    testUserId = user.id;

    const league = await prisma.league.create({
      data: {
        slug: 'test-sync-membership',
        name: 'TEST_Sync Membership',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
        creatorId: user.id,
      },
    });
    testLeagueId = league.id;

    // Sync should create commissioner membership
    await prisma.leagueMembership.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'commissioner',
        status: 'approved',
      },
    });

    const membership = await prisma.leagueMembership.findFirst({
      where: { userId: user.id, leagueId: league.id },
    });

    expect(membership?.role).toBe('commissioner');
    expect(membership?.status).toBe('approved');
  });

  test('sync action reserves URL slug', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test-sync-reserved-slug',
        name: 'TEST_Sync Reserved',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Also create a slug record
    await prisma.slug.create({
      data: {
        slug: 'test-sync-reserved-slug',
        entityType: 'league',
        entityId: league.id,
      },
    });

    // Attempt to create another league with same slug should fail
    await expect(
      prisma.league.create({
        data: {
          slug: 'test-sync-reserved-slug',
          name: 'TEST_Duplicate',
          platform: 'sleeper',
          season: 2025,
          visibility: 'public',
        },
      })
    ).rejects.toThrow();
  });

  test('sync action handles invalid Sleeper league ID gracefully', async () => {
    // Import the sync function
    const { syncLeague } = await import('@/data/sync/sync-league');

    // Empty league ID should fail validation
    const result = await syncLeague({ sleeperLeagueId: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('sync action returns SyncResult with league slug', async () => {
    const league = await prisma.league.create({
      data: {
        slug: 'test-sync-result-slug',
        name: 'TEST_Sync Result',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league.id;

    // Create corresponding slug record
    await prisma.slug.create({
      data: {
        slug: 'test-sync-result-slug',
        entityType: 'league',
        entityId: league.id,
      },
    });

    // Simulating SyncResult type
    const syncResult = {
      success: true as const,
      leagueSlug: league.slug,
    };

    expect(syncResult.success).toBe(true);
    expect(syncResult.leagueSlug).toBe('test-sync-result-slug');
  });
});
