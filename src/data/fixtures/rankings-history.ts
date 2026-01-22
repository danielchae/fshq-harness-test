// Rankings history type definitions and seed data for trajectory visualization
// NOTE: Real implementation uses Prisma in src/data/power-rankings/. These types
// are exported for visualization components; mock data provides fallback/seeding.

import { mockTeams } from './teams';

export interface TeamRankingHistory {
  teamId: string;
  teamName: string;
  color: string;
  history: {
    week: number;
    rank: number;
  }[];
}

export interface RankingsHistoryData {
  leagueSlug: string;
  seasonId: string;
  history: TeamRankingHistory[];
  totalWeeks: number;
}

// Predefined colors for teams (good contrast, colorblind-friendly)
const TEAM_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#65a30d', // lime
  '#e11d48', // rose
  '#0d9488', // teal
  '#7c3aed', // violet
  '#d97706', // amber
];

// Generate mock history data showing team trajectories over weeks
function generateMockHistory(): TeamRankingHistory[] {
  const teams = mockTeams;
  const weeks = 6; // Current week is 3, showing history from week 1-6

  return teams.map((team, teamIndex) => {
    const baseRank = teamIndex + 1;
    const history: { week: number; rank: number }[] = [];

    // Generate realistic rank movements across weeks
    for (let week = 1; week <= weeks; week++) {
      // Create some movement in rankings over weeks
      let rank = baseRank;

      // Add some variability based on week
      if (week === 1) {
        // Starting positions (could be different from current)
        rank = baseRank + (teamIndex % 3 === 0 ? 2 : teamIndex % 3 === 1 ? -1 : 0);
      } else if (week === 2) {
        rank = baseRank + (teamIndex % 3 === 0 ? 1 : teamIndex % 3 === 1 ? 0 : 1);
      } else if (week === 3) {
        rank = baseRank;
      } else if (week === 4) {
        rank = baseRank + (teamIndex % 2 === 0 ? -1 : 1);
      } else if (week === 5) {
        rank = baseRank + (teamIndex % 3 === 0 ? -1 : teamIndex % 3 === 1 ? 1 : 0);
      } else {
        rank = baseRank + (teamIndex % 4 === 0 ? -2 : teamIndex % 4 === 1 ? 1 : 0);
      }

      // Clamp rank to valid range
      rank = Math.max(1, Math.min(teams.length, rank));

      history.push({ week, rank });
    }

    // Ensure we always have a color (TEAM_COLORS array is always populated)
    const colorIndex = teamIndex % TEAM_COLORS.length;
    const color: string = TEAM_COLORS[colorIndex] ?? '#2563eb';

    return {
      teamId: team.id,
      teamName: team.name,
      color,
      history,
    };
  });
}

export const mockRankingsHistory: RankingsHistoryData = {
  leagueSlug: 'test-league',
  seasonId: 'season-2025',
  history: generateMockHistory(),
  totalWeeks: 6,
};

// Storage for different leagues
const historyStore = new Map<string, RankingsHistoryData>();

export function getRankingsHistoryKey(leagueSlug: string): string {
  return leagueSlug;
}

export function getStoredHistory(leagueSlug: string): RankingsHistoryData | null {
  const key = getRankingsHistoryKey(leagueSlug);
  return historyStore.get(key) || null;
}

export function storeHistory(data: RankingsHistoryData): void {
  const key = getRankingsHistoryKey(data.leagueSlug);
  historyStore.set(key, data);
}

// Initialize with mock data
storeHistory(mockRankingsHistory);
