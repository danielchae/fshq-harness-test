// Types for matchups display
// MOCK: Backend will replace with actual database types

export interface MatchupTeamDisplay {
  id: string;
  name: string;
  ownerUsername?: string;
  avatarUrl?: string;
  record?: {
    wins: number;
    losses: number;
    ties: number;
  };
  score?: number; // Either projected or actual score
}

export interface DisplayMatchup {
  id: string;
  homeTeam: MatchupTeamDisplay;
  awayTeam: MatchupTeamDisplay;
  isComplete: boolean;
  winnerId?: string;
  isFeatured?: boolean;
  hypeText?: string;
  weekNumber: number;
}

export interface MatchupsResponse {
  matchups: DisplayMatchup[];
  currentWeek: number;
  totalWeeks: number;
}
