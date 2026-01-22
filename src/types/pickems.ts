// Types for pick'ems feature
// MOCK: Backend will replace with actual database types

export interface PickemTeam {
  id: string;
  name: string;
  ownerUsername: string;
  avatarUrl?: string;
  record?: {
    wins: number;
    losses: number;
    ties: number;
  };
  projectedScore?: number;
  score?: number; // Final score (for completed matchups)
}

// Other users' picks revealed after lock
export interface RevealedPick {
  userId: string;
  userName: string;
  teamId: string;
}

// Pick distribution for locked matchups
export type PickDistribution = Record<string, number>;

export interface PickemMatchup {
  id: string;
  homeTeam: PickemTeam;
  awayTeam: PickemTeam;
  weekNumber: number;
  lockTime: string; // ISO date string
  isLocked: boolean;
  selectedTeamId?: string; // User's current pick for this matchup
  // Revealed data for locked matchups
  picks?: RevealedPick[]; // Other users' picks (only shown when locked)
  distribution?: PickDistribution; // Pick distribution (only shown when locked)
  // Grading data for completed matchups
  isComplete?: boolean; // Whether the matchup has final scores
  winnerId?: string; // The team that won the matchup
  userPick?: string; // The user's pick for this matchup (for grading view)
  isCorrect?: boolean; // Whether the user's pick was correct
  hasStatCorrection?: boolean; // Whether the result was affected by stat correction
}

export interface UserPick {
  matchupId: string;
  selectedTeamId: string;
  submittedAt: string;
}

// Weekly score summary for graded picks
export interface WeeklyScore {
  correct: number;
  total: number;
  percentage: number;
}

export interface PickemsResponse {
  matchups: PickemMatchup[];
  currentWeek: number;
  totalWeeks: number;
  picks: UserPick[];
  lockTimeGlobal?: string; // Global lock time for the week
  // Grading data
  weeklyScore?: WeeklyScore; // Summary of weekly results
  hasSubmittedPicks?: boolean; // Whether user submitted picks for this week
  isWeekComplete?: boolean; // Whether all matchups have final scores
}

export interface SavePicksRequest {
  picks: {
    matchupId: string;
    selectedTeamId: string;
  }[];
}

export interface SavePicksResponse {
  success: boolean;
  savedCount: number;
  totalMatchups: number;
  message: string;
}
