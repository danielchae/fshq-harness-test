// Leaderboard types for pick'ems standings

export type LeaderboardScope = 'weekly' | 'season' | 'all-time';
export type LeaderboardRoleFilter = 'all' | 'manager' | 'fan';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  teamName?: string;
  role: 'commissioner' | 'admin' | 'manager' | 'fan';
  wins: number;
  losses: number;
  totalPicks: number;
  accuracy: number; // percentage 0-100
  isCurrentUser?: boolean;
}

export interface LeaderboardResponse {
  standings: LeaderboardEntry[];
  scope: LeaderboardScope;
  roleFilter: LeaderboardRoleFilter;
  currentWeek: number;
  weekNumber?: number; // for weekly scope
  seasonYear?: number;
  leagueAverage: number; // average accuracy percentage
}

// User stats for personal performance display
export interface UserStats {
  record: {
    wins: number;
    losses: number;
  };
  accuracy: number; // percentage 0-100
  leagueAverage: number;
  isAboveAverage: boolean;
  rank?: {
    overall: number;
    totalParticipants: number;
    roleSpecific?: {
      rank: number;
      total: number;
      role: 'manager' | 'fan';
    };
  };
  hasNoPicks: boolean;
}
