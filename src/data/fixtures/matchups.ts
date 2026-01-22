// Matchup type definitions and seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/matchups/. These types are
// exported for use across the codebase; mock data provides fallback/seeding.

import { mockTeams } from './teams';

export interface MatchupTeam {
  id: string;
  name: string;
  ownerUsername: string;
  avatarUrl?: string;
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
  projectedScore?: number;
  actualScore?: number;
}

export interface Matchup {
  id: string;
  leagueSlug: string;
  weekNumber: number;
  homeTeam: MatchupTeam;
  awayTeam: MatchupTeam;
}

export interface MatchupPrediction {
  id: string;
  matchupId: string;
  leagueSlug: string;
  weekNumber: number;
  homeTeam: MatchupTeam;
  awayTeam: MatchupTeam;
  isFeatured: boolean;
  hypeText: string;
  predictedWinnerId?: string;
  predictedHomeScore?: number;
  predictedAwayScore?: number;
  predictionRationale?: string;
  lastSaved?: string;
}

export interface MatchupPredictionsData {
  id: string;
  leagueSlug: string;
  weekNumber: number;
  predictions: MatchupPrediction[];
  lastSaved: string;
}

// Generate mock matchups by pairing teams
function generateMockMatchups(leagueSlug: string, weekNumber: number): Matchup[] {
  const teams = [...mockTeams];
  const matchups: Matchup[] = [];

  // Pair teams (first with last, second with second-to-last, etc.)
  for (let i = 0; i < Math.floor(teams.length / 2); i++) {
    const homeTeam = teams[i];
    const awayTeam = teams[teams.length - 1 - i];

    if (!homeTeam || !awayTeam) continue;

    matchups.push({
      id: `matchup-${weekNumber}-${i + 1}`,
      leagueSlug,
      weekNumber,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        ownerUsername: homeTeam.ownerUsername,
        avatarUrl: homeTeam.avatarUrl,
        record: homeTeam.record,
        projectedScore: 90 + Math.floor(Math.random() * 40),
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        ownerUsername: awayTeam.ownerUsername,
        avatarUrl: awayTeam.avatarUrl,
        record: awayTeam.record,
        projectedScore: 90 + Math.floor(Math.random() * 40),
      },
    });
  }

  return matchups;
}

// Convert matchups to prediction format with default values
function matchupToPrediction(matchup: Matchup): MatchupPrediction {
  return {
    id: `pred-${matchup.id}`,
    matchupId: matchup.id,
    leagueSlug: matchup.leagueSlug,
    weekNumber: matchup.weekNumber,
    homeTeam: matchup.homeTeam,
    awayTeam: matchup.awayTeam,
    isFeatured: false,
    hypeText: '',
    predictedWinnerId: undefined,
    lastSaved: undefined,
  };
}

// Store for persisting matchup predictions
const predictionsStore = new Map<string, MatchupPredictionsData>();

export function getMatchupPredictionsKey(leagueSlug: string, weekNumber: number): string {
  return `${leagueSlug}-week-${weekNumber}-predictions`;
}

export function getStoredPredictions(leagueSlug: string, weekNumber: number): MatchupPredictionsData | null {
  const key = getMatchupPredictionsKey(leagueSlug, weekNumber);
  return predictionsStore.get(key) || null;
}

export function storePredictions(data: MatchupPredictionsData): void {
  const key = getMatchupPredictionsKey(data.leagueSlug, data.weekNumber);
  predictionsStore.set(key, data);
}

export function getOrCreatePredictions(leagueSlug: string, weekNumber: number): MatchupPredictionsData {
  const existing = getStoredPredictions(leagueSlug, weekNumber);
  if (existing) {
    return existing;
  }

  // Create new predictions from matchups
  const matchups = generateMockMatchups(leagueSlug, weekNumber);
  const predictions = matchups.map(matchupToPrediction);

  const data: MatchupPredictionsData = {
    id: `mp-${leagueSlug}-week-${weekNumber}`,
    leagueSlug,
    weekNumber,
    predictions,
    lastSaved: new Date().toISOString(),
  };

  storePredictions(data);
  return data;
}

// Initialize with some saved data for test-league week 3
const initialData = getOrCreatePredictions('test-league', 3);
// Mark first matchup as featured with hype text for demo purposes
if (initialData.predictions[0]) {
  initialData.predictions[0].isFeatured = true;
  initialData.predictions[0].hypeText =
    'The rivalry continues! Both teams are fighting for playoff positioning in this critical matchup.';
}
storePredictions(initialData);
