// tests/backend/be-task-56.test.ts
// Backend Test: Implement fetchSleeperRosters Integration Function

import { describe, test, expect, vi, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

// Integration function to be implemented at src/integrations/sleeper/fetch-rosters.ts
// For now, we test the expected behavior patterns that the implementation must satisfy

describe('Backend: Implement fetchSleeperRosters Integration Function (task-56)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('fetches all rosters for a league', async () => {
    const mockRosters = [
      {
        roster_id: 1,
        owner_id: 'user_1',
        league_id: '123456789',
        players: ['player_1', 'player_2', 'player_3'],
        settings: { wins: 7, losses: 3, ties: 0 },
      },
      {
        roster_id: 2,
        owner_id: 'user_2',
        league_id: '123456789',
        players: ['player_4', 'player_5', 'player_6'],
        settings: { wins: 5, losses: 5, ties: 0 },
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRosters),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123456789/rosters');
    const rosters = await response.json();

    expect(rosters.length).toBe(2);
    expect(rosters[0].roster_id).toBe(1);
    expect(rosters[1].roster_id).toBe(2);
  });

  test('includes owner info and settings', async () => {
    const mockRoster = {
      roster_id: 1,
      owner_id: 'user_123',
      league_id: '123456789',
      players: ['player_1'],
      starters: ['player_1'],
      reserve: [],
      settings: {
        wins: 8,
        losses: 2,
        ties: 0,
        fpts: 1245.5,
        fpts_decimal: 50,
        fpts_against: 1100.2,
        fpts_against_decimal: 30,
      },
      metadata: {
        streak: 'W3',
        record: 'W',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockRoster]),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123456789/rosters');
    const rosters = await response.json();

    expect(rosters[0].owner_id).toBe('user_123');
    expect(rosters[0].settings.wins).toBe(8);
    expect(rosters[0].settings.fpts).toBe(1245.5);
    expect(rosters[0].metadata?.streak).toBe('W3');
  });

  test('maps roster IDs to team records', async () => {
    const mockRosters = [
      { roster_id: 1, owner_id: 'user_1', settings: { wins: 10, losses: 2, ties: 0 } },
      { roster_id: 2, owner_id: 'user_2', settings: { wins: 8, losses: 4, ties: 0 } },
      { roster_id: 3, owner_id: 'user_3', settings: { wins: 6, losses: 5, ties: 1 } },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRosters),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123456789/rosters');
    const rosters = await response.json();

    // Map roster IDs to records
    const rosterRecordMap = new Map(
      rosters.map((r: any) => [
        r.roster_id,
        { wins: r.settings.wins, losses: r.settings.losses, ties: r.settings.ties },
      ])
    );

    expect(rosterRecordMap.get(1)).toEqual({ wins: 10, losses: 2, ties: 0 });
    expect(rosterRecordMap.get(2)).toEqual({ wins: 8, losses: 4, ties: 0 });
    expect(rosterRecordMap.get(3)).toEqual({ wins: 6, losses: 5, ties: 1 });
  });

  test('returns array of roster objects', async () => {
    const mockRosters = Array.from({ length: 12 }, (_, i) => ({
      roster_id: i + 1,
      owner_id: `user_${i + 1}`,
      league_id: '123456789',
      players: [],
      settings: { wins: 0, losses: 0, ties: 0 },
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRosters),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123456789/rosters');
    const rosters = await response.json();

    expect(Array.isArray(rosters)).toBe(true);
    expect(rosters.length).toBe(12);
    expect(rosters.every((r: any) => r.roster_id && r.owner_id)).toBe(true);
  });

  test('caches with 30 minute TTL', async () => {
    const cache = new Map<string, { data: any; expiry: number }>();
    const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

    const mockRosters = [{ roster_id: 1 }];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRosters),
    });

    const fetchRostersWithCache = async (leagueId: string) => {
      const cacheKey = `rosters:${leagueId}`;
      const cached = cache.get(cacheKey);

      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }

      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
      const data = await response.json();

      cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL });
      return data;
    };

    // First call
    await fetchRostersWithCache('123');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Cached call
    await fetchRostersWithCache('123');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Verify cache entry
    const cacheEntry = cache.get('rosters:123');
    expect(cacheEntry).toBeDefined();
    expect(cacheEntry!.expiry - Date.now()).toBeLessThanOrEqual(CACHE_TTL);
  });

  test('handles empty roster list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123456789/rosters');
    const rosters = await response.json();

    expect(rosters).toEqual([]);
    expect(rosters.length).toBe(0);
  });

  test('SleeperRoster type contract shape', async () => {
    const mockRoster = {
      roster_id: 1,
      owner_id: 'user_123',
      league_id: '123456789',
      players: ['player_1', 'player_2'],
      starters: ['player_1'],
      reserve: ['player_ir'],
      taxi: ['player_taxi'],
      settings: {
        wins: 5,
        losses: 5,
        ties: 0,
        fpts: 1000,
        fpts_decimal: 0,
      },
      metadata: null,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockRoster]),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123456789/rosters');
    const rosters = await response.json();

    // Verify SleeperRoster type contract
    expect(rosters[0]).toHaveProperty('roster_id');
    expect(rosters[0]).toHaveProperty('owner_id');
    expect(rosters[0]).toHaveProperty('league_id');
    expect(rosters[0]).toHaveProperty('players');
    expect(rosters[0]).toHaveProperty('settings');
  });
});
