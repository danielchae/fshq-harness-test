// Leaderboard seed data and helper functions for development/testing
// NOTE: Real implementation uses Prisma in src/data/leaderboard/. Types are defined
// in src/types/leaderboard.ts; this file provides fallback/seed data for testing.

import type { LeaderboardEntry, LeaderboardRoleFilter, LeaderboardScope } from '@/types/leaderboard';

// Mock user data for leaderboard
const MOCK_LEADERBOARD_USERS = [
  { id: 'user-1', username: 'John', role: 'commissioner' as const, teamName: 'Thunder Squad' },
  { id: 'user-2', username: 'Jane', role: 'manager' as const, teamName: 'Victory Lane' },
  { id: 'user-3', username: 'Bob', role: 'manager' as const, teamName: 'Gridiron Gang' },
  { id: 'user-4', username: 'Alice', role: 'manager' as const, teamName: 'Fantasy Flames' },
  { id: 'user-5', username: 'Charlie', role: 'fan' as const },
  { id: 'user-6', username: 'Diana', role: 'manager' as const, teamName: 'Dynasty Builders' },
  { id: 'user-7', username: 'Eve', role: 'fan' as const },
  { id: 'user-8', username: 'Frank', role: 'manager' as const, teamName: 'Touchdown Titans' },
  { id: 'user-9', username: 'Grace', role: 'fan' as const },
  { id: 'user-10', username: 'Henry', role: 'manager' as const, teamName: 'Champion Chasers' },
  { id: 'user-11', username: 'Iris', role: 'fan' as const },
  { id: 'user-12', username: 'Jack', role: 'manager' as const, teamName: 'Playoff Hunters' },
];

// Current user ID (matches auth mock)
const CURRENT_USER_ID = 'user-1';

// Seed-based random for consistent results
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate leaderboard entries based on scope
export function generateLeaderboardEntries(
  scope: LeaderboardScope,
  roleFilter: LeaderboardRoleFilter,
  weekNumber?: number
): LeaderboardEntry[] {
  // Determine multipliers based on scope
  let winsMultiplier = 1;
  let seed = 12345;

  switch (scope) {
    case 'weekly':
      winsMultiplier = 1;
      seed = (weekNumber || 10) * 1000;
      break;
    case 'season':
      winsMultiplier = 10; // ~10 weeks of data
      seed = 54321;
      break;
    case 'all-time':
      winsMultiplier = 30; // ~3 seasons
      seed = 98765;
      break;
  }

  let entries = MOCK_LEADERBOARD_USERS.map((user, index) => {
    const baseSeed = seed + index * 17;
    const baseWins = Math.floor(seededRandom(baseSeed) * 6 + 4) * winsMultiplier; // 4-9 per unit
    const baseLosses = Math.floor(seededRandom(baseSeed + 1) * 4 + 1) * winsMultiplier; // 1-4 per unit
    const totalPicks = baseWins + baseLosses;
    const accuracy = totalPicks > 0 ? Math.round((baseWins / totalPicks) * 100) : 0;

    return {
      id: `entry-${user.id}-${scope}`,
      rank: 0, // Will be set after sorting
      userId: user.id,
      username: user.username,
      avatarUrl: `https://picsum.photos/seed/${user.id}/40/40`,
      teamName: user.teamName,
      role: user.role,
      wins: baseWins,
      losses: baseLosses,
      totalPicks,
      accuracy,
      isCurrentUser: user.id === CURRENT_USER_ID,
    };
  });

  // Filter by role
  if (roleFilter !== 'all') {
    if (roleFilter === 'manager') {
      // Managers include commissioner, admin, and manager roles
      entries = entries.filter((e) => ['commissioner', 'admin', 'manager'].includes(e.role));
    } else {
      // Fans only
      entries = entries.filter((e) => e.role === 'fan');
    }
  }

  // Sort by wins (descending), then by accuracy (descending) as tiebreaker
  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.accuracy - a.accuracy;
  });

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

// Calculate league average accuracy
export function calculateLeagueAverage(entries: LeaderboardEntry[]): number {
  if (entries.length === 0) return 0;
  const totalAccuracy = entries.reduce((sum, e) => sum + e.accuracy, 0);
  return Math.round(totalAccuracy / entries.length);
}

// Mock constants
export const MOCK_CURRENT_WEEK = 10;
export const MOCK_CURRENT_SEASON = 2025;
