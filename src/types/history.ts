// Types for league history and season archive

export interface TeamStanding {
  teamId: string;
  teamName: string;
  managerName: string;
  avatarUrl: string;
  rank: number;
  wins: number;
  losses: number;
  ties?: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffResult?: 'champion' | 'runner-up' | 'third' | 'semifinalist' | 'quarterfinalist' | 'missed';
}

export interface SeasonSummary {
  id: string;
  year: number;
  leagueId: string;
  leagueName: string;
  format: 'dynasty' | 'redraft' | 'keeper';
  teamCount: number;
  completed: boolean;
  champion: {
    teamId: string;
    teamName: string;
    managerName: string;
    avatarUrl: string;
    record: string;
    totalPoints: number;
  };
  runnerUp: {
    teamId: string;
    teamName: string;
    managerName: string;
    avatarUrl: string;
    record: string;
    totalPoints: number;
  };
  championshipScore: {
    championPoints: number;
    runnerUpPoints: number;
    week: number;
  };
  regularSeasonWinner?: {
    teamId: string;
    teamName: string;
    managerName: string;
    record: string;
  };
  standings: TeamStanding[];
  stats: {
    totalPointsScored: number;
    highestScoringWeek: {
      teamName: string;
      points: number;
      week: number;
    };
    averagePointsPerGame: number;
    playoffTeams: number;
  };
}

export interface AllTimeRecord {
  type: 'most-championships' | 'best-regular-season' | 'most-points' | 'most-wins' | 'most-playoff-appearances';
  title: string;
  holder: {
    name: string;
    avatarUrl: string;
  };
  value: string;
  seasons?: string[];
}

export interface LeagueHistoryResponse {
  seasons: SeasonSummary[];
  allTimeRecords: AllTimeRecord[];
}

export interface GetLeagueHistoryInput {
  leagueSlug: string;
}

export interface GetSeasonDetailInput {
  leagueSlug: string;
  year: number;
}
