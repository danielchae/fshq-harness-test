// Sleeper API seed data for development/testing
// NOTE: Real implementation uses Sleeper API in src/data/sleeper/. Types are defined
// in src/types/sleeper.ts; this file provides fallback/seed data for testing.

import type { SleeperLeague, SleeperUser } from '@/types/sleeper';

export const mockSleeperUsers: Record<string, SleeperUser> = {
  validuser123: {
    user_id: 'sleeper-user-1',
    username: 'validuser123',
    display_name: 'Valid User',
    avatar: 'https://picsum.photos/seed/sleeper1/50/50',
  },
  testuser: {
    user_id: 'sleeper-user-2',
    username: 'testuser',
    display_name: 'Test User',
    avatar: 'https://picsum.photos/seed/sleeper2/50/50',
  },
};

export const mockSleeperLeagues: Record<string, SleeperLeague[]> = {
  'sleeper-user-1': [
    {
      league_id: 'sleeper-league-1',
      id: 'sleeper-league-1', // Legacy compatibility
      name: 'Dynasty Champions',
      total_rosters: 12,
      team_count: 12, // Legacy compatibility
      season: '2024',
      avatar: 'https://picsum.photos/seed/dynasty1/100/100',
      sport: 'nfl',
      status: 'in_season',
    },
    {
      league_id: 'sleeper-league-2',
      id: 'sleeper-league-2',
      name: 'Redraft Warriors',
      total_rosters: 10,
      team_count: 10,
      season: '2024',
      avatar: 'https://picsum.photos/seed/redraft1/100/100',
      sport: 'nfl',
      status: 'in_season',
    },
    {
      league_id: 'sleeper-league-3',
      id: 'sleeper-league-3',
      name: 'Best Ball Masters',
      total_rosters: 14,
      team_count: 14,
      season: '2024',
      sport: 'nfl',
      status: 'complete',
    },
  ],
  'sleeper-user-2': [
    {
      league_id: 'sleeper-league-4',
      id: 'sleeper-league-4',
      name: 'Test League',
      total_rosters: 12,
      team_count: 12,
      season: '2024',
      sport: 'nfl',
      status: 'pre_draft',
    },
  ],
};
