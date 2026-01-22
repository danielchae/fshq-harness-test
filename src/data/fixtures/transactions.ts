// Transaction seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/transactions/. Types are defined
// in src/types/transactions.ts; this file provides fallback/seed data for testing.

import type { Transaction } from '@/types/transactions';

export const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    type: 'trade',
    timestamp: '2024-01-15T18:30:00Z',
    teams: [
      {
        id: 'team-1',
        name: 'Touchdown Titans',
        avatarUrl: 'https://picsum.photos/seed/team1/100/100',
        playersOut: ['Patrick Mahomes', '2025 1st Round Pick'],
        playersIn: ['Josh Allen', 'Garrett Wilson'],
      },
      {
        id: 'team-2',
        name: 'Dynasty Dragons',
        avatarUrl: 'https://picsum.photos/seed/team2/100/100',
        playersOut: ['Josh Allen', 'Garrett Wilson'],
        playersIn: ['Patrick Mahomes', '2025 1st Round Pick'],
      },
    ],
    status: 'completed',
  },
  {
    id: 'tx-2',
    type: 'waiver',
    timestamp: '2024-01-15T08:00:00Z',
    team: {
      id: 'team-3',
      name: 'Gridiron Giants',
      avatarUrl: 'https://picsum.photos/seed/team3/100/100',
    },
    playerAdded: 'Puka Nacua',
    playerAddedDetails: {
      id: 'player-1',
      name: 'Puka Nacua',
      position: 'WR',
      nflTeam: 'LAR',
    },
    playerDropped: 'Rashid Shaheed',
    playerDroppedDetails: {
      id: 'player-2',
      name: 'Rashid Shaheed',
      position: 'WR',
      nflTeam: 'NO',
    },
    faabAmount: 25,
  },
  {
    id: 'tx-3',
    type: 'free_agent',
    timestamp: '2024-01-14T14:22:00Z',
    team: {
      id: 'team-4',
      name: 'Fantasy Phenoms',
      avatarUrl: 'https://picsum.photos/seed/team4/100/100',
    },
    playerAdded: 'Tank Dell',
    playerAddedDetails: {
      id: 'player-3',
      name: 'Tank Dell',
      position: 'WR',
      nflTeam: 'HOU',
    },
    playerDropped: 'Elijah Moore',
    playerDroppedDetails: {
      id: 'player-4',
      name: 'Elijah Moore',
      position: 'WR',
      nflTeam: 'CLE',
    },
  },
  {
    id: 'tx-4',
    type: 'trade',
    timestamp: '2024-01-13T20:15:00Z',
    teams: [
      {
        id: 'team-5',
        name: 'Sunday Slayers',
        avatarUrl: 'https://picsum.photos/seed/team5/100/100',
        playersOut: ['CeeDee Lamb'],
        playersIn: ['Amon-Ra St. Brown', '2025 2nd Round Pick'],
      },
      {
        id: 'team-6',
        name: 'End Zone Experts',
        avatarUrl: 'https://picsum.photos/seed/team6/100/100',
        playersOut: ['Amon-Ra St. Brown', '2025 2nd Round Pick'],
        playersIn: ['CeeDee Lamb'],
      },
    ],
    status: 'completed',
  },
  {
    id: 'tx-5',
    type: 'waiver',
    timestamp: '2024-01-13T08:00:00Z',
    team: {
      id: 'team-1',
      name: 'Touchdown Titans',
      avatarUrl: 'https://picsum.photos/seed/team1/100/100',
    },
    playerAdded: 'Jaylen Warren',
    playerAddedDetails: {
      id: 'player-5',
      name: 'Jaylen Warren',
      position: 'RB',
      nflTeam: 'PIT',
    },
    playerDropped: 'Roschon Johnson',
    playerDroppedDetails: {
      id: 'player-6',
      name: 'Roschon Johnson',
      position: 'RB',
      nflTeam: 'CHI',
    },
    waiverPriority: 3,
  },
  {
    id: 'tx-6',
    type: 'drop',
    timestamp: '2024-01-12T16:45:00Z',
    team: {
      id: 'team-2',
      name: 'Dynasty Dragons',
      avatarUrl: 'https://picsum.photos/seed/team2/100/100',
    },
    playerDropped: 'Odell Beckham Jr.',
    playerDroppedDetails: {
      id: 'player-7',
      name: 'Odell Beckham Jr.',
      position: 'WR',
      nflTeam: 'MIA',
    },
  },
  {
    id: 'tx-7',
    type: 'free_agent',
    timestamp: '2024-01-12T10:30:00Z',
    team: {
      id: 'team-3',
      name: 'Gridiron Giants',
      avatarUrl: 'https://picsum.photos/seed/team3/100/100',
    },
    playerAdded: 'Zay Flowers',
    playerAddedDetails: {
      id: 'player-8',
      name: 'Zay Flowers',
      position: 'WR',
      nflTeam: 'BAL',
    },
  },
  {
    id: 'tx-8',
    type: 'trade',
    timestamp: '2024-01-11T19:00:00Z',
    teams: [
      {
        id: 'team-4',
        name: 'Fantasy Phenoms',
        avatarUrl: 'https://picsum.photos/seed/team4/100/100',
        playersOut: ['Travis Kelce'],
        playersIn: ['Sam LaPorta', 'DeVonta Smith'],
      },
      {
        id: 'team-5',
        name: 'Sunday Slayers',
        avatarUrl: 'https://picsum.photos/seed/team5/100/100',
        playersOut: ['Sam LaPorta', 'DeVonta Smith'],
        playersIn: ['Travis Kelce'],
      },
    ],
    status: 'completed',
  },
  {
    id: 'tx-9',
    type: 'waiver',
    timestamp: '2024-01-11T08:00:00Z',
    team: {
      id: 'team-6',
      name: 'End Zone Experts',
      avatarUrl: 'https://picsum.photos/seed/team6/100/100',
    },
    playerAdded: 'Jahmyr Gibbs',
    playerAddedDetails: {
      id: 'player-9',
      name: 'Jahmyr Gibbs',
      position: 'RB',
      nflTeam: 'DET',
    },
    playerDropped: 'Tyler Allgeier',
    playerDroppedDetails: {
      id: 'player-10',
      name: 'Tyler Allgeier',
      position: 'RB',
      nflTeam: 'ATL',
    },
    faabAmount: 42,
  },
  {
    id: 'tx-10',
    type: 'free_agent',
    timestamp: '2024-01-10T13:15:00Z',
    team: {
      id: 'team-1',
      name: 'Touchdown Titans',
      avatarUrl: 'https://picsum.photos/seed/team1/100/100',
    },
    playerAdded: 'Jordan Addison',
    playerAddedDetails: {
      id: 'player-11',
      name: 'Jordan Addison',
      position: 'WR',
      nflTeam: 'MIN',
    },
    playerDropped: 'Skyy Moore',
    playerDroppedDetails: {
      id: 'player-12',
      name: 'Skyy Moore',
      position: 'WR',
      nflTeam: 'KC',
    },
  },
  // Additional transactions for pagination testing
  {
    id: 'tx-11',
    type: 'drop',
    timestamp: '2024-01-09T22:00:00Z',
    team: {
      id: 'team-4',
      name: 'Fantasy Phenoms',
      avatarUrl: 'https://picsum.photos/seed/team4/100/100',
    },
    playerDropped: 'Kadarius Toney',
    playerDroppedDetails: {
      id: 'player-13',
      name: 'Kadarius Toney',
      position: 'WR',
      nflTeam: 'KC',
    },
  },
  {
    id: 'tx-12',
    type: 'waiver',
    timestamp: '2024-01-09T08:00:00Z',
    team: {
      id: 'team-2',
      name: 'Dynasty Dragons',
      avatarUrl: 'https://picsum.photos/seed/team2/100/100',
    },
    playerAdded: 'Rome Odunze',
    playerAddedDetails: {
      id: 'player-14',
      name: 'Rome Odunze',
      position: 'WR',
      nflTeam: 'CHI',
    },
    playerDropped: 'Van Jefferson',
    playerDroppedDetails: {
      id: 'player-15',
      name: 'Van Jefferson',
      position: 'WR',
      nflTeam: 'ATL',
    },
  },
];
