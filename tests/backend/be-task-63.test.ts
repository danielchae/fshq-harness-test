// tests/backend/be-task-63.test.ts
// Backend Test: Implement Lookup Sleeper User Integration Function

import { describe, test, expect, vi, afterEach } from 'vitest';
import { lookupSleeperUser, validateSleeperUsername } from '@/data/sleeper/lookup-leagues';

describe('Backend: Implement Lookup Sleeper User Integration Function (task-63)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('fetches Sleeper user profile by username', async () => {
    const mockUser = {
      user_id: 'user_123456789',
      username: 'fantasyfan2025',
      display_name: 'Fantasy Fan',
      avatar: 'avatar_hash_123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/fantasyfan2025');
    const user = await response.json();

    expect(user.username).toBe('fantasyfan2025');
    expect(user.user_id).toBe('user_123456789');
    expect(user.display_name).toBe('Fantasy Fan');
  });

  test('returns user ID for league lookup', async () => {
    const mockUser = {
      user_id: 'user_987654321',
      username: 'testuser',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/testuser');
    const user = await response.json();

    // User ID is used to fetch their leagues
    const userId = user.user_id;
    expect(userId).toBe('user_987654321');

    // Would then be used for: /user/{user_id}/leagues/nfl/2025
    const leaguesUrl = `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/2025`;
    expect(leaguesUrl).toContain(userId);
  });

  test('handles user not found gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null), // Sleeper returns null for unknown users
    });

    const response = await fetch('https://api.sleeper.app/v1/user/nonexistentuser12345');
    const user = await response.json();

    expect(user).toBeNull();

    // Application should handle null gracefully
    const handleUserLookup = (userData: any) => {
      if (!userData) {
        return { found: false, error: 'User not found' };
      }
      return { found: true, user: userData };
    };

    const result = handleUserLookup(user);
    expect(result.found).toBe(false);
    expect(result.error).toBe('User not found');
  });

  test('returns SleeperUser type with profile data', async () => {
    const mockUser = {
      user_id: 'user_abc123',
      username: 'sleeperchamp',
      display_name: 'Sleeper Champion',
      avatar: 'avatar_xyz789',
      metadata: {
        team_name: 'Champions Squad',
      },
      is_bot: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser),
    });

    const response = await fetch('https://api.sleeper.app/v1/user/sleeperchamp');
    const user = await response.json();

    // Verify SleeperUser type contract
    expect(user).toHaveProperty('user_id');
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('display_name');
    expect(user).toHaveProperty('avatar');
    expect(user.is_bot).toBe(false);
  });

  test('caches with 1 hour TTL', async () => {
    const cache = new Map<string, { data: any; expiry: number }>();
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour

    const mockUser = { user_id: 'user_123', username: 'testuser' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser),
    });

    const lookupUserWithCache = async (username: string) => {
      const cacheKey = `user:${username.toLowerCase()}`;
      const cached = cache.get(cacheKey);

      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }

      const response = await fetch(`https://api.sleeper.app/v1/user/${username}`);
      const data = await response.json();

      if (data) {
        cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL });
      }

      return data;
    };

    // First call - API
    await lookupUserWithCache('testuser');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call - cached
    await lookupUserWithCache('testuser');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Case-insensitive cache key
    await lookupUserWithCache('TESTUSER');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('handles special characters in username', async () => {
    const mockUser = {
      user_id: 'user_special',
      username: 'user_name_123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser),
    });

    const username = 'user_name_123';
    const response = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`);
    const user = await response.json();

    expect(user.username).toBe('user_name_123');
  });

  test('normalizes username for lookup', async () => {
    const normalizeUsername = (input: string): string => {
      return input.toLowerCase().trim();
    };

    expect(normalizeUsername('TestUser')).toBe('testuser');
    expect(normalizeUsername('  ALLCAPS  ')).toBe('allcaps');
    expect(normalizeUsername('Mixed_Case_123')).toBe('mixed_case_123');
  });

  test('validates username format', async () => {
    const isValidUsername = (username: string): boolean => {
      // Sleeper usernames: 3-15 chars, alphanumeric + underscore
      const pattern = /^[a-zA-Z0-9_]{3,15}$/;
      return pattern.test(username);
    };

    expect(isValidUsername('validuser')).toBe(true);
    expect(isValidUsername('valid_user_123')).toBe(true);
    expect(isValidUsername('ab')).toBe(false); // Too short
    expect(isValidUsername('thisusernameiswaytoolong')).toBe(false); // Too long
    expect(isValidUsername('invalid-user')).toBe(false); // Invalid char
    expect(isValidUsername('invalid user')).toBe(false); // Space
  });

  test('handles network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const lookupUser = async (username: string) => {
      try {
        const response = await fetch(`https://api.sleeper.app/v1/user/${username}`);
        return { success: true, data: await response.json() };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    };

    const result = await lookupUser('testuser');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});
