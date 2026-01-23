// Leaderboard types for pick'ems standings

import type { SeasonStatus } from '@/lib/nfl-week';

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

/**
 * Season state for leaderboard
 */
export interface LeaderboardSeasonState {
  /** Current season status */
  status: SeasonStatus;
  /** Whether the fantasy season is complete */
  isSeasonComplete: boolean;
  /** Status message for display */
  statusMessage: string;
  /** Last week with pick'em data */
  lastActiveWeek: number;
  /** Championship week */
  championshipWeek: number;
  /** Available weeks for weekly view */
  availableWeeks: number[];
}

export interface LeaderboardResponse {
  standings: LeaderboardEntry[];
  scope: LeaderboardScope;
  roleFilter: LeaderboardRoleFilter;
  currentWeek: number;
  weekNumber?: number; // for weekly scope
  seasonYear?: number;
  leagueAverage: number; // average accuracy percentage
  /** Season state information */
  seasonState?: LeaderboardSeasonState;
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
