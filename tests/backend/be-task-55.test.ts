// tests/backend/be-task-55.test.ts
// Backend Test: Implement fetchSleeperLeague Integration Function

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchSleeperLeague,
  fetchSleeperLeagueWithResult,
  invalidateLeagueCache,
  clearLeagueCache,
  getCacheStats,
  CACHE_TTL_MS,
  MAX_RETRIES,
} from '@/integrations/sleeper/fetch-league';

describe('Backend: Implement fetchSleeperLeague Integration Function (task-55)', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearLeagueCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('fetches league metadata by league ID', async () => {
    const mockLeague = {
      league_id: '123456789',
      name: 'TEST_Fantasy League',
      sport: 'nfl',
      season: '2025',
      season_type: 'regular',
      total_rosters: 12,
      status: 'in_season',
      settings: {
        playoff_week_start: 15,
        playoff_teams: 6,
      },
    };

    // Mock fetch response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeague),
    });

    const league = await fetchSleeperLeague('123456789');

    expect(league).not.toBeNull();
    expect(league?.league_id).toBe('123456789');
    expect(league?.name).toBe('TEST_Fantasy League');
    expect(league?.sport).toBe('nfl');
    expect(league?.total_rosters).toBe(12);
  });

  test('handles rate limiting with exponential backoff', async () => {
    let attemptCount = 0;

    // Mock rate limit response then success
    global.fetch = vi.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ league_id: '123', name: 'Success League', sport: 'nfl', total_rosters: 10, season: '2025', status: 'in_season' }),
      });
    });

    const league = await fetchSleeperLeague('123');

    expect(league).not.toBeNull();
    expect(league?.league_id).toBe('123');
    // Should have retried on 429 and eventually succeeded
    expect(attemptCount).toBe(3);
  });

  test('returns SleeperLeague type with all fields', async () => {
    const mockLeague = {
      league_id: '123456789',
      name: 'TEST_Complete League',
      sport: 'nfl',
      season: '2025',
      season_type: 'regular',
      total_rosters: 12,
      status: 'in_season',
      settings: {},
      scoring_settings: {},
      roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'],
      avatar: 'abc123',
      draft_id: 'draft_123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeague),
    });

    const league = await fetchSleeperLeague('123456789');

    // Verify SleeperLeague type contract
    expect(league).toHaveProperty('league_id');
    expect(league).toHaveProperty('name');
    expect(league).toHaveProperty('sport');
    expect(league).toHaveProperty('season');
    expect(league).toHaveProperty('total_rosters');
    expect(league).toHaveProperty('settings');
    expect(league).toHaveProperty('roster_positions');
  });

  test('caches responses to minimize API calls', async () => {
    const mockLeague = { league_id: '123', name: 'TEST_Cached League', sport: 'nfl', total_rosters: 10, season: '2025', status: 'in_season' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeague),
    });

    // First call - hits API
    const result1 = await fetchSleeperLeague('123');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call - from cache
    const result2 = await fetchSleeperLeague('123');
    expect(fetch).toHaveBeenCalledTimes(1); // Still 1 - served from cache

    expect(result1?.league_id).toBe(result2?.league_id);

    // Verify cache has entry
    const stats = getCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.entries[0]?.leagueId).toBe('123');
  });

  test('handles network errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // fetchSleeperLeague returns null on network errors after retries
    const result = await fetchSleeperLeague('123');
    expect(result).toBeNull();
  });

  test('handles invalid league ID (404)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const result = await fetchSleeperLeague('invalid_id');
    expect(result).toBeNull();
  });

  test('fetchSleeperLeagueWithResult returns detailed error for 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const result = await fetchSleeperLeagueWithResult('invalid_id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND');
      expect(result.error).toContain('not found');
    }
  });

  test('invalidateLeagueCache removes cached entry', async () => {
    const mockLeague = { league_id: '456', name: 'TEST_Invalidate', sport: 'nfl', total_rosters: 8, season: '2025', status: 'in_season' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeague),
    });

    // Populate cache
    await fetchSleeperLeague('456');
    expect(getCacheStats().size).toBe(1);

    // Invalidate cache
    invalidateLeagueCache('456');
    expect(getCacheStats().size).toBe(0);

    // Next call should hit API
    await fetchSleeperLeague('456');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('rejects empty or invalid league IDs', async () => {
    global.fetch = vi.fn();

    const result1 = await fetchSleeperLeague('');
    expect(result1).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    const result2 = await fetchSleeperLeague('   ');
    expect(result2).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('skipCache option forces API call', async () => {
    const mockLeague = { league_id: '789', name: 'TEST_SkipCache', sport: 'nfl', total_rosters: 12, season: '2025', status: 'in_season' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeague),
    });

    // First call populates cache
    await fetchSleeperLeague('789');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call with skipCache should hit API
    await fetchSleeperLeague('789', { skipCache: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('fetchSleeperLeagueWithResult indicates cache hit', async () => {
    const mockLeague = { league_id: 'cache-test', name: 'TEST_CacheHit', sport: 'nfl', total_rosters: 10, season: '2025', status: 'in_season' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeague),
    });

    // First call - fresh fetch
    const result1 = await fetchSleeperLeagueWithResult('cache-test');
    expect(result1.success).toBe(true);
    if (result1.success) {
      expect(result1.fromCache).toBe(false);
    }

    // Second call - from cache
    const result2 = await fetchSleeperLeagueWithResult('cache-test');
    expect(result2.success).toBe(true);
    if (result2.success) {
      expect(result2.fromCache).toBe(true);
    }
  });
});
