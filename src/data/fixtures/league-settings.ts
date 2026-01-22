// League settings seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/settings/. Types are defined
// in src/types/league-settings.ts; this file provides fallback/seed data.

import type { LeagueSettings } from '@/types/league-settings';

export const mockLeagueSettings: Record<string, LeagueSettings> = {
  'test-league': {
    id: 'settings-1',
    leagueId: 'league-1',
    leagueSlug: 'test-league',
    platform: 'sleeper',
    platformLeagueId: 'test-league-id',
    visibility: 'public',
    joinRule: 'auto-join',
    fanAccessEnabled: true,
    fanLimit: 50,
    currentFanCount: 12,
    description:
      'Welcome to the Test League! This is a competitive fantasy football league where we compete for bragging rights and glory. Join us for weekly matchups, trash talk, and memorable moments throughout the season.',
    publicContent: {
      rankings: true,
      matchups: true,
      brackets: true,
      transactions: false,
      history: true,
    },
    createdAt: '2024-08-01T00:00:00.000Z',
    updatedAt: '2025-01-15T10:30:00.000Z',
  },
  'dynasty-legends': {
    id: 'settings-2',
    leagueId: 'league-2',
    leagueSlug: 'dynasty-legends',
    platform: 'sleeper',
    platformLeagueId: 'dynasty-league-id',
    visibility: 'private',
    joinRule: 'approval-required',
    fanAccessEnabled: false,
    fanLimit: null,
    currentFanCount: 0,
    description:
      'Dynasty Legends is an invite-only dynasty league for serious fantasy football enthusiasts. We value long-term strategy, player development, and competitive integrity.',
    publicContent: {
      rankings: false,
      matchups: false,
      brackets: false,
      transactions: false,
      history: false,
    },
    createdAt: '2023-05-15T00:00:00.000Z',
    updatedAt: '2025-01-10T14:00:00.000Z',
  },
  'demo-league': {
    id: 'settings-3',
    leagueId: 'league-3',
    leagueSlug: 'demo-league',
    platform: 'sleeper',
    platformLeagueId: 'demo-league-id',
    visibility: 'public',
    joinRule: 'auto-join',
    fanAccessEnabled: true,
    fanLimit: null,
    currentFanCount: 25,
    description:
      "Demo League is a friendly fantasy football community open to all skill levels. Whether you're a seasoned veteran or just getting started, you'll find a welcoming environment here.",
    publicContent: {
      rankings: true,
      matchups: true,
      brackets: true,
      transactions: true,
      history: true,
    },
    createdAt: '2022-01-01T00:00:00.000Z',
    updatedAt: '2025-01-18T08:00:00.000Z',
  },
  'new-league': {
    id: 'settings-4',
    leagueId: 'league-4',
    leagueSlug: 'new-league',
    platform: 'sleeper',
    platformLeagueId: 'new-league-id',
    visibility: 'private',
    joinRule: 'approval-required',
    fanAccessEnabled: true,
    fanLimit: 20,
    currentFanCount: 3,
    description: 'A brand new league looking for dedicated managers to join our community.',
    publicContent: {
      rankings: true,
      matchups: false,
      brackets: false,
      transactions: false,
      history: false,
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
};
