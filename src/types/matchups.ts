// Types for matchups display

import type { SeasonStatus } from '@/lib/nfl-week';

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

/**
 * Season state for matchups page
 */
export interface MatchupsSeasonState {
  /** Current season status */
  status: SeasonStatus;
  /** Whether the fantasy season is complete */
  isSeasonComplete: boolean;
  /** Status message for display */
  statusMessage: string;
  /** Last week with matchup data */
  lastActiveWeek: number;
  /** Championship week for this league */
  championshipWeek: number;
  /** Available weeks to browse */
  availableWeeks: number[];
}

export interface MatchupsResponse {
  matchups: DisplayMatchup[];
  currentWeek: number;
  totalWeeks: number;
  /** Season state information */
  seasonState?: MatchupsSeasonState;
}
