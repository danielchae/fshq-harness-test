// Members seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/members/. Types are defined
// in src/types/member.ts; this file provides fallback/seed data for testing.

import type { LeagueMember, PendingMember } from '@/types/member';

// Demo league members - 15+ members with Admin, Commissioner, Manager, Fan roles
// Note: E2E tests expect roles to be capitalized: Admin, Commissioner, Manager, Fan
export const DEMO_LEAGUE_MEMBERS: LeagueMember[] = [
  // Admin (1)
  {
    id: 'demo-member-1',
    userId: 'demo-user-1',
    leagueId: 'demo-league',
    name: 'John Smith',
    email: 'john@example.com',
    avatarUrl: 'https://picsum.photos/seed/john/80/80',
    role: 'admin',
    teamName: 'Bayou Bengals',
    joinedAt: '2024-01-15T10:00:00Z',
    lastActive: '2026-01-18T08:30:00Z',
  },
  // Commissioner (1)
  {
    id: 'demo-member-2',
    userId: 'demo-user-2',
    leagueId: 'demo-league',
    name: 'Jane Doe',
    email: 'jane@example.com',
    avatarUrl: 'https://picsum.photos/seed/jane/80/80',
    role: 'commissioner',
    teamName: 'Metro Mustangs',
    joinedAt: '2024-02-01T14:30:00Z',
    lastActive: '2026-01-17T16:45:00Z',
  },
  // Managers (10 - one for each remaining team)
  {
    id: 'demo-member-3',
    userId: 'demo-user-3',
    leagueId: 'demo-league',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    avatarUrl: 'https://picsum.photos/seed/bob/80/80',
    role: 'manager',
    teamName: 'Coastal Condors',
    joinedAt: '2024-02-15T09:00:00Z',
    lastActive: '2026-01-16T12:00:00Z',
  },
  {
    id: 'demo-member-4',
    userId: 'demo-user-4',
    leagueId: 'demo-league',
    name: 'Alice Williams',
    email: 'alice@example.com',
    avatarUrl: 'https://picsum.photos/seed/alice/80/80',
    role: 'manager',
    teamName: 'Mountain Mavericks',
    joinedAt: '2024-03-01T11:15:00Z',
    lastActive: '2026-01-18T10:00:00Z',
  },
  {
    id: 'demo-member-5',
    userId: 'demo-user-5',
    leagueId: 'demo-league',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    avatarUrl: 'https://picsum.photos/seed/charlie/80/80',
    role: 'manager',
    teamName: 'Lakeside Lions',
    joinedAt: '2024-03-15T08:00:00Z',
    lastActive: '2026-01-15T14:30:00Z',
  },
  {
    id: 'demo-member-6',
    userId: 'demo-user-6',
    leagueId: 'demo-league',
    name: 'Diana Ross',
    email: 'diana@example.com',
    avatarUrl: 'https://picsum.photos/seed/diana/80/80',
    role: 'manager',
    teamName: 'Desert Dragons',
    joinedAt: '2024-04-01T13:00:00Z',
    lastActive: '2026-01-18T09:15:00Z',
  },
  {
    id: 'demo-member-7',
    userId: 'demo-user-7',
    leagueId: 'demo-league',
    name: 'Eve Miller',
    email: 'eve@example.com',
    avatarUrl: 'https://picsum.photos/seed/eve/80/80',
    role: 'manager',
    teamName: 'Valley Vikings',
    joinedAt: '2024-04-15T10:30:00Z',
    lastActive: '2026-01-17T18:00:00Z',
  },
  {
    id: 'demo-member-8',
    userId: 'demo-user-8',
    leagueId: 'demo-league',
    name: 'Frank Garcia',
    email: 'frank@example.com',
    avatarUrl: 'https://picsum.photos/seed/frank/80/80',
    role: 'manager',
    teamName: 'Harbor Hawks',
    joinedAt: '2024-05-01T09:45:00Z',
    lastActive: '2026-01-18T07:30:00Z',
  },
  {
    id: 'demo-member-9',
    userId: 'demo-user-9',
    leagueId: 'demo-league',
    name: 'Grace Lee',
    email: 'grace@example.com',
    avatarUrl: 'https://picsum.photos/seed/grace/80/80',
    role: 'manager',
    teamName: 'Prairie Panthers',
    joinedAt: '2024-05-15T11:00:00Z',
    lastActive: '2026-01-17T20:00:00Z',
  },
  {
    id: 'demo-member-10',
    userId: 'demo-user-10',
    leagueId: 'demo-league',
    name: 'Henry Wilson',
    email: 'henry@example.com',
    avatarUrl: 'https://picsum.photos/seed/henry/80/80',
    role: 'manager',
    teamName: 'River Raptors',
    joinedAt: '2024-06-01T14:00:00Z',
    lastActive: '2026-01-18T06:00:00Z',
  },
  {
    id: 'demo-member-11',
    userId: 'demo-user-11',
    leagueId: 'demo-league',
    name: 'Iris Chen',
    email: 'iris@example.com',
    avatarUrl: 'https://picsum.photos/seed/iris/80/80',
    role: 'manager',
    teamName: 'Summit Sharks',
    joinedAt: '2024-06-15T16:30:00Z',
    lastActive: '2026-01-16T22:00:00Z',
  },
  {
    id: 'demo-member-12',
    userId: 'demo-user-12',
    leagueId: 'demo-league',
    name: 'Jack Taylor',
    email: 'jack@example.com',
    avatarUrl: 'https://picsum.photos/seed/jack/80/80',
    role: 'manager',
    teamName: 'Timber Titans',
    joinedAt: '2024-07-01T08:00:00Z',
    lastActive: '2026-01-18T11:30:00Z',
  },
  // Fans (4)
  {
    id: 'demo-member-13',
    userId: 'demo-user-13',
    leagueId: 'demo-league',
    name: 'Kelly Martinez',
    email: 'kelly@example.com',
    avatarUrl: 'https://picsum.photos/seed/kelly/80/80',
    role: 'fan',
    joinedAt: '2024-07-15T12:00:00Z',
    lastActive: '2026-01-17T15:00:00Z',
  },
  {
    id: 'demo-member-14',
    userId: 'demo-user-14',
    leagueId: 'demo-league',
    name: 'Liam Anderson',
    email: 'liam@example.com',
    avatarUrl: 'https://picsum.photos/seed/liam/80/80',
    role: 'fan',
    joinedAt: '2024-08-01T09:30:00Z',
    lastActive: '2026-01-18T13:45:00Z',
  },
  {
    id: 'demo-member-15',
    userId: 'demo-user-15',
    leagueId: 'demo-league',
    name: 'Mia Thompson',
    email: 'mia@example.com',
    avatarUrl: 'https://picsum.photos/seed/mia/80/80',
    role: 'fan',
    joinedAt: '2024-08-15T17:00:00Z',
    lastActive: '2026-01-16T19:30:00Z',
  },
  {
    id: 'demo-member-16',
    userId: 'demo-user-16',
    leagueId: 'demo-league',
    name: 'Noah Davis',
    email: 'noah@example.com',
    avatarUrl: 'https://picsum.photos/seed/noah/80/80',
    role: 'fan',
    joinedAt: '2024-09-01T10:00:00Z',
    lastActive: '2026-01-18T08:00:00Z',
  },
];

// Legacy MOCK_MEMBERS for backward compatibility with other league slugs
export const MOCK_MEMBERS: LeagueMember[] = [
  {
    id: 'member-1',
    userId: 'user-1',
    leagueId: 'test-league',
    name: 'John Smith',
    email: 'john@example.com',
    avatarUrl: 'https://picsum.photos/seed/john/80/80',
    role: 'commissioner',
    teamName: 'Thunder Squad',
    joinedAt: '2024-01-15T10:00:00Z',
    lastActive: '2026-01-18T08:30:00Z',
  },
  {
    id: 'member-2',
    userId: 'user-2',
    leagueId: 'test-league',
    name: 'Jane Doe',
    email: 'jane@example.com',
    avatarUrl: 'https://picsum.photos/seed/jane/80/80',
    role: 'admin',
    teamName: 'Victory Lane',
    joinedAt: '2024-02-01T14:30:00Z',
    lastActive: '2026-01-17T16:45:00Z',
  },
  {
    id: 'member-3',
    userId: 'user-3',
    leagueId: 'test-league',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    avatarUrl: 'https://picsum.photos/seed/bob/80/80',
    role: 'manager',
    teamName: 'Gridiron Gang',
    joinedAt: '2024-02-15T09:00:00Z',
    lastActive: '2026-01-16T12:00:00Z',
  },
  {
    id: 'member-4',
    userId: 'user-4',
    leagueId: 'test-league',
    name: 'Alice Williams',
    email: 'alice@example.com',
    avatarUrl: 'https://picsum.photos/seed/alice/80/80',
    role: 'manager',
    teamName: 'Fantasy Flames',
    joinedAt: '2024-03-01T11:15:00Z',
    lastActive: '2026-01-18T10:00:00Z',
  },
  {
    id: 'member-5',
    userId: 'user-5',
    leagueId: 'test-league',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    avatarUrl: 'https://picsum.photos/seed/charlie/80/80',
    role: 'fan',
    joinedAt: '2024-03-15T08:00:00Z',
    lastActive: '2026-01-15T14:30:00Z',
  },
  {
    id: 'member-6',
    userId: 'user-6',
    leagueId: 'test-league',
    name: 'Diana Ross',
    email: 'diana@example.com',
    avatarUrl: 'https://picsum.photos/seed/diana/80/80',
    role: 'manager',
    teamName: 'Dynasty Builders',
    joinedAt: '2024-04-01T13:00:00Z',
    lastActive: '2026-01-18T09:15:00Z',
  },
  {
    id: 'member-7',
    userId: 'user-7',
    leagueId: 'test-league',
    name: 'Eve Miller',
    email: 'eve@example.com',
    avatarUrl: 'https://picsum.photos/seed/eve/80/80',
    role: 'fan',
    joinedAt: '2024-04-15T10:30:00Z',
    lastActive: '2026-01-17T18:00:00Z',
  },
  {
    id: 'member-8',
    userId: 'user-8',
    leagueId: 'test-league',
    name: 'Frank Garcia',
    email: 'frank@example.com',
    avatarUrl: 'https://picsum.photos/seed/frank/80/80',
    role: 'manager',
    teamName: 'Touchdown Titans',
    joinedAt: '2024-05-01T09:45:00Z',
    lastActive: '2026-01-18T07:30:00Z',
  },
];

export const MOCK_PENDING_MEMBERS: PendingMember[] = [
  // No pending members by default
  // Tests will mock the API route to add pending members
];

// Get members by league slug
export function getMockMembersByLeague(leagueSlug: string): LeagueMember[] {
  // Return demo league members for demo-league
  if (leagueSlug === 'demo-league') {
    return DEMO_LEAGUE_MEMBERS;
  }
  // Return test-league members
  if (leagueSlug === 'test-league') {
    return MOCK_MEMBERS;
  }
  // Returns empty array for leagues without members
  return [];
}

// Get pending members by league slug
export function getMockPendingMembersByLeague(leagueSlug: string): PendingMember[] {
  // Return empty array by default
  // Tests will mock the API route
  return MOCK_PENDING_MEMBERS.filter(() => leagueSlug === 'demo-league' || true);
}
