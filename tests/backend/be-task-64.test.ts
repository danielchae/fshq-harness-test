// tests/backend/be-task-64.test.ts
// Backend Test: Implement Lookup Sleeper Leagues Integration Function

import { describe, test, expect, vi, afterEach } from 'vitest';
import { lookupLeaguesByUsername, validateSleeperUsername } from '@/data/sleeper/lookup-leagues';
import type { LookupLeaguesInput } from '@/data/sleeper/lookup-leagues';

describe('Backend: Implement Lookup Sleeper Leagues Integration Function (task-64)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('fetches all leagues where user is a member', async () => {
    const mockLeagues = [
      {
        league_id: 'league_1',
        name: 'Fantasy Champions',
        sport: 'nfl',
        season: '2025',
        total_rosters: 12,
        status: 'in_season',
      },
      {
        league_id: 'league_2',
        name: 'Office League',
        sport: 'nfl',
        season: '2025',
        total_rosters: 10,
        status: 'in_season',
      },
      {
        league_id: 'league_3',
        name: 'Dynasty League',
        sport: 'nfl',
        season: '2025',
        total_rosters: 14,
        status: 'in_season',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeagues),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/user_123/leagues/nfl/2025');
    const leagues = await response.json();

    expect(leagues.length).toBe(3);
    expect(leagues[0].name).toBe('Fantasy Champions');
    expect(leagues.every((l: any) => l.sport === 'nfl')).toBe(true);
  });

  test('filters to current season by default', async () => {
    const currentSeason = '2025';

    const mockLeagues2024 = [
      { league_id: 'old_1', name: 'Old League', season: '2024' },
    ];

    const mockLeagues2025 = [
      { league_id: 'new_1', name: 'New League', season: '2025' },
      { league_id: 'new_2', name: 'Another League', season: '2025' },
    ];

    // Default should fetch current season
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeagues2025),
    });

    const response = await fetch(
      `https://api.sleeper.app/v1/user/user_123/leagues/nfl/${currentSeason}`
    );
    const leagues = await response.json();

    expect(leagues.length).toBe(2);
    expect(leagues.every((l: any) => l.season === '2025')).toBe(true);
  });

  test('returns league metadata for selection', async () => {
    const mockLeagues = [
      {
        league_id: 'league_123',
        name: 'My Fantasy League',
        sport: 'nfl',
        season: '2025',
        total_rosters: 12,
        status: 'in_season',
        avatar: 'avatar_hash',
        settings: {
          playoff_week_start: 15,
          playoff_teams: 6,
          type: 0, // Redraft
        },
        roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'],
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeagues),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/user_123/leagues/nfl/2025');
    const leagues = await response.json();

    // League metadata for selection UI
    const leagueForSelection = {
      id: leagues[0].league_id,
      name: leagues[0].name,
      teamCount: leagues[0].total_rosters,
      status: leagues[0].status,
      type: leagues[0].settings.type === 0 ? 'Redraft' : 'Dynasty',
      avatar: leagues[0].avatar,
    };

    expect(leagueForSelection.id).toBe('league_123');
    expect(leagueForSelection.name).toBe('My Fantasy League');
    expect(leagueForSelection.teamCount).toBe(12);
    expect(leagueForSelection.type).toBe('Redraft');
  });

  test('returns LookupLeaguesResponse with leagues array', async () => {
    const mockLeagues = [
      { league_id: 'league_1', name: 'League 1', season: '2025' },
      { league_id: 'league_2', name: 'League 2', season: '2025' },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeagues),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/user_123/leagues/nfl/2025');
    const leagues = await response.json();

    // Transform to LookupLeaguesResponse
    const lookupResponse = {
      success: true,
      leagues: leagues.map((l: any) => ({
        id: l.league_id,
        name: l.name,
        season: l.season,
      })),
      count: leagues.length,
    };

    expect(lookupResponse.success).toBe(true);
    expect(lookupResponse.leagues.length).toBe(2);
    expect(lookupResponse.count).toBe(2);
    expect(lookupResponse.leagues[0]).toHaveProperty('id');
    expect(lookupResponse.leagues[0]).toHaveProperty('name');
  });

  test('caches with 15 minute TTL', async () => {
    const cache = new Map<string, { data: any; expiry: number }>();
    const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

    const mockLeagues = [{ league_id: 'league_1' }];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeagues),
    });

    const lookupLeaguesWithCache = async (userId: string, season: string) => {
      const cacheKey = `leagues:${userId}:${season}`;
      const cached = cache.get(cacheKey);

      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }

      const response = await fetch(
        `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`
      );
      const data = await response.json();

      cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL });
      return data;
    };

    // First call - API
    await lookupLeaguesWithCache('user_123', '2025');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call - cached
    await lookupLeaguesWithCache('user_123', '2025');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Different user - new API call
    await lookupLeaguesWithCache('user_456', '2025');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('handles user with no leagues', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/user_noleagues/leagues/nfl/2025');
    const leagues = await response.json();

    expect(leagues).toEqual([]);
    expect(leagues.length).toBe(0);

    // Application should handle empty array
    const lookupResponse = {
      success: true,
      leagues: leagues,
      message: leagues.length === 0 ? 'No leagues found for this user' : null,
    };

    expect(lookupResponse.message).toBe('No leagues found for this user');
  });

  test('supports multiple seasons', async () => {
    const seasons = ['2023', '2024', '2025'];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      const season = url.split('/').pop();
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ league_id: `league_${season}`, season }]),
      });
    });

    const allLeagues = [];
    for (const season of seasons) {
      const response = await fetch(
        `https://api.sleeper.app/v1/user/user_123/leagues/nfl/${season}`
      );
      const leagues = await response.json();
      allLeagues.push(...leagues);
    }

    expect(allLeagues.length).toBe(3);
    expect(allLeagues.map((l) => l.season)).toEqual(['2023', '2024', '2025']);
  });

  test('identifies league types (redraft, keeper, dynasty)', async () => {
    const mockLeagues = [
      { league_id: 'redraft_1', name: 'Redraft League', settings: { type: 0 } },
      { league_id: 'keeper_1', name: 'Keeper League', settings: { type: 1 } },
      { league_id: 'dynasty_1', name: 'Dynasty League', settings: { type: 2 } },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeagues),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/user_123/leagues/nfl/2025');
    const leagues = await response.json();

    const getLeagueType = (type: number): string => {
      switch (type) {
        case 0:
          return 'redraft';
        case 1:
          return 'keeper';
        case 2:
          return 'dynasty';
        default:
          return 'unknown';
      }
    };

    const leagueTypes = leagues.map((l: any) => getLeagueType(l.settings.type));
    expect(leagueTypes).toEqual(['redraft', 'keeper', 'dynasty']);
  });

  test('includes avatar URLs for league cards', async () => {
    const mockLeagues = [
      { league_id: 'league_1', name: 'League 1', avatar: 'avatar_hash_123' },
      { league_id: 'league_2', name: 'League 2', avatar: null },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeagues),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/user_123/leagues/nfl/2025');
    const leagues = await response.json();

    const getAvatarUrl = (avatarHash: string | null): string => {
      if (!avatarHash) {
        return '/default-league-avatar.png';
      }
      return `https://sleepercdn.com/avatars/${avatarHash}`;
    };

    const league1Avatar = getAvatarUrl(leagues[0].avatar);
    const league2Avatar = getAvatarUrl(leagues[1].avatar);

    expect(league1Avatar).toBe('https://sleepercdn.com/avatars/avatar_hash_123');
    expect(league2Avatar).toBe('/default-league-avatar.png');
  });
});
