// League type definitions and seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/leagues/. These types are
// exported for use across the codebase; mock data provides fallback/seeding.

export interface League {
  id: string;
  slug: string;
  name: string;
  description: string;
  teamCount: number;
  season: number;
  platform: 'sleeper' | 'espn' | 'yahoo';
  avatarUrl?: string;
  createdAt: string;
  visibility: 'public' | 'private';
  joinRule: 'auto-join' | 'approval';
}

export const mockLeagues: League[] = [
  {
    id: 'league-1',
    slug: 'test-league',
    name: 'Test League',
    description: 'A test fantasy football league for development',
    teamCount: 12,
    season: 2025,
    platform: 'sleeper',
    avatarUrl: 'https://picsum.photos/seed/league1/100/100',
    createdAt: '2024-08-01T00:00:00.000Z',
    visibility: 'private',
    joinRule: 'approval',
  },
  {
    id: 'league-2',
    slug: 'dynasty-legends',
    name: 'Dynasty Legends',
    description: 'Dynasty fantasy football league',
    teamCount: 10,
    season: 2025,
    platform: 'sleeper',
    avatarUrl: 'https://picsum.photos/seed/league2/100/100',
    createdAt: '2023-05-15T00:00:00.000Z',
    visibility: 'private',
    joinRule: 'approval',
  },
  {
    id: 'league-3',
    slug: 'demo-league',
    name: 'Demo League',
    description: 'Demo fantasy football league for testing',
    teamCount: 12,
    season: 2025,
    platform: 'sleeper',
    avatarUrl: 'https://picsum.photos/seed/demoleague/100/100',
    createdAt: '2022-01-01T00:00:00.000Z',
    visibility: 'public',
    joinRule: 'auto-join',
  },
  {
    id: 'league-4',
    slug: 'new-league',
    name: 'New League',
    description: 'A brand new league with no history',
    teamCount: 10,
    season: 2025,
    platform: 'sleeper',
    avatarUrl: 'https://picsum.photos/seed/newleague/100/100',
    createdAt: '2025-01-01T00:00:00.000Z',
    visibility: 'public',
    joinRule: 'auto-join',
  },
];

export interface LeagueMember {
  id: string;
  leagueId: string;
  userId: string;
  username: string;
  role: 'commissioner' | 'admin' | 'manager' | 'fan';
  teamName?: string;
  avatarUrl?: string;
}

export const mockLeagueMembers: LeagueMember[] = [
  {
    id: 'member-1',
    leagueId: 'league-1',
    userId: 'user-1',
    username: 'testuser',
    role: 'commissioner',
    teamName: 'Test Team',
    avatarUrl: 'https://picsum.photos/seed/user1/50/50',
  },
  {
    id: 'member-2',
    leagueId: 'league-1',
    userId: 'user-2',
    username: 'adminuser',
    role: 'admin',
    teamName: 'Admin Team',
    avatarUrl: 'https://picsum.photos/seed/user2/50/50',
  },
  {
    id: 'member-3',
    leagueId: 'league-1',
    userId: 'user-3',
    username: 'manager1',
    role: 'manager',
    teamName: 'Manager Team',
    avatarUrl: 'https://picsum.photos/seed/user3/50/50',
  },
];
