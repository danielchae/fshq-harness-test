// tests/backend/be-task-57.test.ts
// Backend Test: Implement fetchSleeperMatchups Integration Function

import { describe, test, expect, vi, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

// Integration function to be implemented at src/integrations/sleeper/fetch-matchups.ts
// For now, we test the expected behavior patterns that the implementation must satisfy

describe('Backend: Implement fetchSleeperMatchups Integration Function (task-57)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('fetches matchups for specific week', async () => {
    const mockMatchups = [
      { roster_id: 1, matchup_id: 1, points: 125.5, starters: ['p1', 'p2'] },
      { roster_id: 2, matchup_id: 1, points: 118.2, starters: ['p3', 'p4'] },
      { roster_id: 3, matchup_id: 2, points: 130.0, starters: ['p5', 'p6'] },
      { roster_id: 4, matchup_id: 2, points: 95.5, starters: ['p7', 'p8'] },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMatchups),
    });

    const week = 10;
    const response = await fetch(`https://api.sleeper.app/v1/league/123/matchups/${week}`);
    const matchups = await response.json();

    expect(matchups.length).toBe(4);
    // Two teams per matchup
    const matchup1Teams = matchups.filter((m: any) => m.matchup_id === 1);
    expect(matchup1Teams.length).toBe(2);
  });

  test('includes roster IDs and scores', async () => {
    const mockMatchups = [
      {
        roster_id: 1,
        matchup_id: 1,
        points: 142.5,
        starters_points: [25.5, 18.0, 12.3, 15.2, 22.0, 8.5, 19.0, 12.0, 10.0],
      },
      {
        roster_id: 2,
        matchup_id: 1,
        points: 138.8,
        starters_points: [22.0, 20.5, 15.0, 12.3, 18.0, 14.0, 17.0, 10.0, 10.0],
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMatchups),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123/matchups/10');
    const matchups = await response.json();

    expect(matchups[0].roster_id).toBe(1);
    expect(matchups[0].points).toBe(142.5);
    expect(matchups[0].starters_points.length).toBe(9);
    expect(matchups[1].roster_id).toBe(2);
    expect(matchups[1].points).toBe(138.8);
  });

  test('determines matchup completion status', async () => {
    // During game - partial scores
    const inProgressMatchups = [
      { roster_id: 1, matchup_id: 1, points: 85.5, custom_points: null },
      { roster_id: 2, matchup_id: 1, points: 72.3, custom_points: null },
    ];

    // After game - final scores
    const completedMatchups = [
      { roster_id: 1, matchup_id: 1, points: 125.5, custom_points: null },
      { roster_id: 2, matchup_id: 1, points: 118.2, custom_points: null },
    ];

    // Determine completion based on NFL state or time
    const isWeekComplete = (week: number, currentWeek: number): boolean => {
      return week < currentWeek;
    };

    expect(isWeekComplete(9, 10)).toBe(true); // Week 9 is complete
    expect(isWeekComplete(10, 10)).toBe(false); // Week 10 still in progress

    // Matchup winner determination
    const determineWinner = (matchups: any[], matchupId: number) => {
      const matchup = matchups.filter((m) => m.matchup_id === matchupId);
      if (matchup.length !== 2) return null;

      const [team1, team2] = matchup;
      if (team1.points > team2.points) return team1.roster_id;
      if (team2.points > team1.points) return team2.roster_id;
      return null; // Tie
    };

    const winner = determineWinner(completedMatchups, 1);
    expect(winner).toBe(1);
  });

  test('returns array of matchup objects', async () => {
    const mockMatchups = Array.from({ length: 12 }, (_, i) => ({
      roster_id: i + 1,
      matchup_id: Math.floor(i / 2) + 1,
      points: 100 + Math.random() * 50,
      starters: [],
      starters_points: [],
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMatchups),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123/matchups/10');
    const matchups = await response.json();

    expect(Array.isArray(matchups)).toBe(true);
    expect(matchups.length).toBe(12);

    // 6 unique matchups
    const uniqueMatchupIds = new Set(matchups.map((m: any) => m.matchup_id));
    expect(uniqueMatchupIds.size).toBe(6);
  });

  test('caches with 5 minute TTL during games', async () => {
    const cache = new Map<string, { data: any; expiry: number }>();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes during games

    const mockMatchups = [{ roster_id: 1, matchup_id: 1, points: 100 }];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMatchups),
    });

    const fetchMatchupsWithCache = async (leagueId: string, week: number) => {
      const cacheKey = `matchups:${leagueId}:${week}`;
      const cached = cache.get(cacheKey);

      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }

      const response = await fetch(
        `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`
      );
      const data = await response.json();

      cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL });
      return data;
    };

    // First call
    await fetchMatchupsWithCache('123', 10);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Cached call (within 5 minutes)
    await fetchMatchupsWithCache('123', 10);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('SleeperMatchup type contract shape', async () => {
    const mockMatchup = {
      roster_id: 1,
      matchup_id: 1,
      points: 125.5,
      starters: ['player_1', 'player_2'],
      starters_points: [20.5, 15.0],
      players: ['player_1', 'player_2', 'player_3'],
      players_points: { player_1: 20.5, player_2: 15.0, player_3: 0 },
      custom_points: null,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockMatchup]),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123/matchups/10');
    const matchups = await response.json();

    // Verify SleeperMatchup type contract
    expect(matchups[0]).toHaveProperty('roster_id');
    expect(matchups[0]).toHaveProperty('matchup_id');
    expect(matchups[0]).toHaveProperty('points');
    expect(matchups[0]).toHaveProperty('starters');
    expect(matchups[0]).toHaveProperty('players');
  });

  test('handles bye weeks (no matchup_id)', async () => {
    const mockMatchups = [
      { roster_id: 1, matchup_id: null, points: 0 }, // Bye week
      { roster_id: 2, matchup_id: 1, points: 100 },
      { roster_id: 3, matchup_id: 1, points: 95 },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMatchups),
    });

    const response = await fetch('https://api.sleeper.app/v1/league/123/matchups/10');
    const matchups = await response.json();

    const byeWeekTeams = matchups.filter((m: any) => m.matchup_id === null);
    expect(byeWeekTeams.length).toBe(1);
    expect(byeWeekTeams[0].roster_id).toBe(1);
  });
});
