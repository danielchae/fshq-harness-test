// League types for data fetching hooks

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
}

export interface LeagueResponse {
  league: League | null;
  error?: string;
}
