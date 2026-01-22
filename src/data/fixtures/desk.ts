// Commissioner desk type definitions and seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/desk/. These types are
// exported for desk components; mock data provides fallback/seeding.

export interface Season {
  id: string;
  year: number;
  label: string;
}

export interface Week {
  id: string;
  number: number;
  label: string;
  status: 'published' | 'draft' | 'empty';
  lastEdited?: string;
  publishedAt?: string;
}

export interface DeskDraft {
  id: string;
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  type: 'power-rankings' | 'matchup-predictions' | 'posts';
  content: string;
  status: 'draft' | 'published';
  lastSaved: string;
  createdAt: string;
  updatedAt: string;
}

export const mockSeasons: Season[] = [
  { id: 'season-2025', year: 2025, label: '2025 Season' },
  { id: 'season-2024', year: 2024, label: '2024 Season' },
  { id: 'season-2023', year: 2023, label: '2023 Season' },
];

export const mockWeeks: Week[] = [
  { id: 'week-1', number: 1, label: 'Week 1', status: 'published', publishedAt: '2025-09-05T12:00:00Z' },
  { id: 'week-2', number: 2, label: 'Week 2', status: 'published', publishedAt: '2025-09-12T12:00:00Z' },
  { id: 'week-3', number: 3, label: 'Week 3', status: 'draft', lastEdited: '2025-09-18T15:30:00Z' },
  { id: 'week-4', number: 4, label: 'Week 4', status: 'empty' },
  { id: 'week-5', number: 5, label: 'Week 5', status: 'empty' },
  { id: 'week-6', number: 6, label: 'Week 6', status: 'empty' },
  { id: 'week-7', number: 7, label: 'Week 7', status: 'empty' },
  { id: 'week-8', number: 8, label: 'Week 8', status: 'empty' },
  { id: 'week-9', number: 9, label: 'Week 9', status: 'empty' },
  { id: 'week-10', number: 10, label: 'Week 10', status: 'empty' },
  { id: 'week-11', number: 11, label: 'Week 11', status: 'empty' },
  { id: 'week-12', number: 12, label: 'Week 12', status: 'empty' },
  { id: 'week-13', number: 13, label: 'Week 13', status: 'empty' },
  { id: 'week-14', number: 14, label: 'Week 14', status: 'empty' },
  { id: 'week-15', number: 15, label: 'Week 15 (Playoffs)', status: 'empty' },
  { id: 'week-16', number: 16, label: 'Week 16 (Playoffs)', status: 'empty' },
  { id: 'week-17', number: 17, label: 'Week 17 (Championship)', status: 'empty' },
];

export const mockDrafts: DeskDraft[] = [
  {
    id: 'draft-1',
    leagueSlug: 'test-league',
    seasonId: 'season-2025',
    weekNumber: 3,
    type: 'power-rankings',
    content: 'Team A remains on top after a dominant week...',
    status: 'draft',
    lastSaved: '2025-09-18T15:30:00Z',
    createdAt: '2025-09-17T10:00:00Z',
    updatedAt: '2025-09-18T15:30:00Z',
  },
  {
    id: 'draft-2',
    leagueSlug: 'test-league',
    seasonId: 'season-2025',
    weekNumber: 3,
    type: 'matchup-predictions',
    content: 'Prediction: Team A vs Team B will be a close matchup...',
    status: 'draft',
    lastSaved: '2025-09-18T14:00:00Z',
    createdAt: '2025-09-17T10:00:00Z',
    updatedAt: '2025-09-18T14:00:00Z',
  },
];

// Current week calculation - returns week 3 for mock purposes
export function getCurrentWeek(): number {
  return 3;
}

// Get current season
export function getCurrentSeason(): Season {
  const season = mockSeasons[0];
  if (!season) {
    throw new Error('No seasons available');
  }
  return season;
}
