/**
 * Types for playoff bracket visualization
 */

export interface BracketTeam {
  id: string;
  name: string;
  seed: number;
  avatarUrl?: string;
  record?: {
    wins: number;
    losses: number;
    ties?: number;
  };
}

export interface BracketMatchupTeam {
  team: BracketTeam | null; // null for TBD/placeholder
  score?: number;
  isWinner?: boolean;
  isBye?: boolean;
}

export interface BracketMatchup {
  id: string;
  roundIndex: number;
  matchupIndex: number;
  homeTeam: BracketMatchupTeam;
  awayTeam: BracketMatchupTeam;
  isComplete: boolean;
  winnerId?: string;
  status: 'scheduled' | 'in_progress' | 'complete';
  sourceMatchups?: {
    home?: string; // matchup ID that winner feeds into home slot
    away?: string; // matchup ID that winner feeds into away slot
  };
}

export interface BracketRound {
  index: number;
  name: string; // e.g., "Quarterfinals", "Semifinals", "Championship"
  matchups: BracketMatchup[];
  isCurrent: boolean;
}

export interface PlayoffBracket {
  id: string;
  leagueId: string;
  season: number;
  type: 'winners' | 'losers' | 'consolation';
  rounds: BracketRound[];
  champion?: BracketTeam;
  playoffsStartWeek: number;
  currentRoundIndex: number;
}

export interface BracketResponse {
  playoffsStartWeek: number;
  hasStarted: boolean;
  currentWeek: number;
  bracket: PlayoffBracket | null;
  consolationBracket?: PlayoffBracket | null;
  hasConsolation?: boolean;
  availableSeasons?: number[];
  season: number;
}
