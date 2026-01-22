// Brackets seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/brackets/. Types are defined
// in src/types/brackets.ts; this file provides fallback/seed data for testing.

import type { BracketMatchup, BracketResponse, BracketRound, BracketTeam, PlayoffBracket } from '@/types/brackets';

// Mock playoff teams (6-team playoff bracket)
export const mockPlayoffTeams: BracketTeam[] = [
  {
    id: 'team-3',
    name: 'Gridiron Warriors',
    seed: 1,
    avatarUrl: 'https://picsum.photos/seed/team3/100/100',
    record: { wins: 10, losses: 2, ties: 0 },
  },
  {
    id: 'team-6',
    name: 'End Zone Experts',
    seed: 2,
    avatarUrl: 'https://picsum.photos/seed/team6/100/100',
    record: { wins: 9, losses: 3, ties: 0 },
  },
  {
    id: 'team-1',
    name: 'Touchdown Titans',
    seed: 3,
    avatarUrl: 'https://picsum.photos/seed/team1/100/100',
    record: { wins: 8, losses: 4, ties: 0 },
  },
  {
    id: 'team-2',
    name: 'Fantasy Champions',
    seed: 4,
    avatarUrl: 'https://picsum.photos/seed/team2/100/100',
    record: { wins: 7, losses: 5, ties: 0 },
  },
  {
    id: 'team-4',
    name: 'Sunday Slayers',
    seed: 5,
    avatarUrl: 'https://picsum.photos/seed/team4/100/100',
    record: { wins: 6, losses: 6, ties: 0 },
  },
  {
    id: 'team-5',
    name: 'Dynasty Dominators',
    seed: 6,
    avatarUrl: 'https://picsum.photos/seed/team5/100/100',
    record: { wins: 5, losses: 7, ties: 0 },
  },
];

// Generate a 6-team playoff bracket (2 teams get first round bye)
export function generateMockBracket(leagueId: string): PlayoffBracket {
  const teams = mockPlayoffTeams;

  // Round 1: Quarterfinals (seeds 3-6 play, seeds 1-2 have bye)
  const round1Matchups: BracketMatchup[] = [
    {
      id: 'matchup-r1-1',
      roundIndex: 0,
      matchupIndex: 0,
      homeTeam: {
        team: teams[2]!, // Seed 3
        score: 128.5,
        isWinner: true,
      },
      awayTeam: {
        team: teams[5]!, // Seed 6
        score: 102.3,
        isWinner: false,
      },
      isComplete: true,
      winnerId: teams[2]!.id,
      status: 'complete',
    },
    {
      id: 'matchup-r1-2',
      roundIndex: 0,
      matchupIndex: 1,
      homeTeam: {
        team: teams[3]!, // Seed 4
        score: 115.8,
        isWinner: false,
      },
      awayTeam: {
        team: teams[4]!, // Seed 5
        score: 122.4,
        isWinner: true,
      },
      isComplete: true,
      winnerId: teams[4]!.id,
      status: 'complete',
    },
  ];

  // Round 2: Semifinals (winners vs bye teams)
  const round2Matchups: BracketMatchup[] = [
    {
      id: 'matchup-r2-1',
      roundIndex: 1,
      matchupIndex: 0,
      homeTeam: {
        team: teams[0]!, // Seed 1 (bye)
        score: 145.2,
        isWinner: true,
      },
      awayTeam: {
        team: teams[4]!, // Winner of R1-M2 (Seed 5)
        score: 118.7,
        isWinner: false,
      },
      isComplete: true,
      winnerId: teams[0]!.id,
      status: 'complete',
      sourceMatchups: {
        away: 'matchup-r1-2',
      },
    },
    {
      id: 'matchup-r2-2',
      roundIndex: 1,
      matchupIndex: 1,
      homeTeam: {
        team: teams[1]!, // Seed 2 (bye)
        score: 131.4,
        isWinner: false,
      },
      awayTeam: {
        team: teams[2]!, // Winner of R1-M1 (Seed 3)
        score: 138.9,
        isWinner: true,
      },
      isComplete: true,
      winnerId: teams[2]!.id,
      status: 'complete',
      sourceMatchups: {
        away: 'matchup-r1-1',
      },
    },
  ];

  // Round 3: Championship
  const round3Matchups: BracketMatchup[] = [
    {
      id: 'matchup-r3-1',
      roundIndex: 2,
      matchupIndex: 0,
      homeTeam: {
        team: teams[0]!, // Seed 1 (winner of R2-M1)
        score: 142.8,
        isWinner: false,
      },
      awayTeam: {
        team: teams[2]!, // Seed 3 (winner of R2-M2)
        score: 151.2,
        isWinner: true,
      },
      isComplete: true,
      winnerId: teams[2]!.id,
      status: 'complete',
      sourceMatchups: {
        home: 'matchup-r2-1',
        away: 'matchup-r2-2',
      },
    },
  ];

  const rounds: BracketRound[] = [
    {
      index: 0,
      name: 'Quarterfinals',
      matchups: round1Matchups,
      isCurrent: false,
    },
    {
      index: 1,
      name: 'Semifinals',
      matchups: round2Matchups,
      isCurrent: false,
    },
    {
      index: 2,
      name: 'Championship',
      matchups: round3Matchups,
      isCurrent: true,
    },
  ];

  return {
    id: 'bracket-1',
    leagueId,
    season: 2024,
    type: 'winners',
    rounds,
    champion: teams[2]!, // Gridiron Warriors won!
    playoffsStartWeek: 14,
    currentRoundIndex: 2,
  };
}

// Generate in-progress bracket (playoffs ongoing)
export function generateInProgressBracket(leagueId: string): PlayoffBracket {
  const teams = mockPlayoffTeams;

  // Round 1: Quarterfinals - complete
  const round1Matchups: BracketMatchup[] = [
    {
      id: 'matchup-r1-1',
      roundIndex: 0,
      matchupIndex: 0,
      homeTeam: {
        team: teams[2]!, // Seed 3
        score: 128.5,
        isWinner: true,
      },
      awayTeam: {
        team: teams[5]!, // Seed 6
        score: 102.3,
        isWinner: false,
      },
      isComplete: true,
      winnerId: teams[2]!.id,
      status: 'complete',
    },
    {
      id: 'matchup-r1-2',
      roundIndex: 0,
      matchupIndex: 1,
      homeTeam: {
        team: teams[3]!, // Seed 4
        score: 115.8,
        isWinner: false,
      },
      awayTeam: {
        team: teams[4]!, // Seed 5
        score: 122.4,
        isWinner: true,
      },
      isComplete: true,
      winnerId: teams[4]!.id,
      status: 'complete',
    },
  ];

  // Round 2: Semifinals - in progress
  const round2Matchups: BracketMatchup[] = [
    {
      id: 'matchup-r2-1',
      roundIndex: 1,
      matchupIndex: 0,
      homeTeam: {
        team: teams[0]!, // Seed 1 (bye)
        score: 87.3,
        isWinner: false,
      },
      awayTeam: {
        team: teams[4]!, // Winner of R1-M2 (Seed 5)
        score: 92.1,
        isWinner: false,
      },
      isComplete: false,
      status: 'in_progress',
      sourceMatchups: {
        away: 'matchup-r1-2',
      },
    },
    {
      id: 'matchup-r2-2',
      roundIndex: 1,
      matchupIndex: 1,
      homeTeam: {
        team: teams[1]!, // Seed 2 (bye)
        score: 76.5,
        isWinner: false,
      },
      awayTeam: {
        team: teams[2]!, // Winner of R1-M1 (Seed 3)
        score: 81.2,
        isWinner: false,
      },
      isComplete: false,
      status: 'in_progress',
      sourceMatchups: {
        away: 'matchup-r1-1',
      },
    },
  ];

  // Round 3: Championship - TBD
  const round3Matchups: BracketMatchup[] = [
    {
      id: 'matchup-r3-1',
      roundIndex: 2,
      matchupIndex: 0,
      homeTeam: {
        team: null, // TBD
      },
      awayTeam: {
        team: null, // TBD
      },
      isComplete: false,
      status: 'scheduled',
      sourceMatchups: {
        home: 'matchup-r2-1',
        away: 'matchup-r2-2',
      },
    },
  ];

  const rounds: BracketRound[] = [
    {
      index: 0,
      name: 'Quarterfinals',
      matchups: round1Matchups,
      isCurrent: false,
    },
    {
      index: 1,
      name: 'Semifinals',
      matchups: round2Matchups,
      isCurrent: true,
    },
    {
      index: 2,
      name: 'Championship',
      matchups: round3Matchups,
      isCurrent: false,
    },
  ];

  return {
    id: 'bracket-1',
    leagueId,
    season: 2024,
    type: 'winners',
    rounds,
    playoffsStartWeek: 14,
    currentRoundIndex: 1,
  };
}

// Generate consolation bracket for losers of first round
export function generateConsolationBracket(leagueId: string, isComplete = false): PlayoffBracket {
  const teams = mockPlayoffTeams;

  // Consolation bracket: losers from Round 1 + non-playoff teams
  // In a 6-team playoff, losers of Quarterfinals play for 5th place
  const consolationRound1Matchups: BracketMatchup[] = [
    {
      id: 'consolation-r1-1',
      roundIndex: 0,
      matchupIndex: 0,
      homeTeam: {
        team: teams[5]!, // Seed 6 (lost to Seed 3)
        score: isComplete ? 98.4 : undefined,
        isWinner: isComplete ? false : undefined,
      },
      awayTeam: {
        team: teams[3]!, // Seed 4 (lost to Seed 5)
        score: isComplete ? 112.7 : undefined,
        isWinner: isComplete ? true : undefined,
      },
      isComplete,
      winnerId: isComplete ? teams[3]!.id : undefined,
      status: isComplete ? 'complete' : 'scheduled',
    },
  ];

  const consolationRound2Matchups: BracketMatchup[] = [
    {
      id: 'consolation-r2-1',
      roundIndex: 1,
      matchupIndex: 0,
      homeTeam: isComplete
        ? {
            team: teams[3]!, // Winner of consolation R1
            score: 105.2,
            isWinner: true,
          }
        : { team: null },
      awayTeam: isComplete
        ? {
            team: teams[4]!, // Loser of Semifinals (Seed 5)
            score: 95.8,
            isWinner: false,
          }
        : { team: null },
      isComplete,
      winnerId: isComplete ? teams[3]!.id : undefined,
      status: isComplete ? 'complete' : 'scheduled',
      sourceMatchups: {
        home: 'consolation-r1-1',
      },
    },
  ];

  const rounds: BracketRound[] = [
    {
      index: 0,
      name: '5th Place Semifinal',
      matchups: consolationRound1Matchups,
      isCurrent: !isComplete,
    },
    {
      index: 1,
      name: '5th Place Game',
      matchups: consolationRound2Matchups,
      isCurrent: false,
    },
  ];

  return {
    id: 'consolation-bracket-1',
    leagueId,
    season: 2024,
    type: 'consolation',
    rounds,
    champion: isComplete ? teams[3]! : undefined, // Fantasy Champions won consolation
    playoffsStartWeek: 14,
    currentRoundIndex: isComplete ? 1 : 0,
  };
}

// Generate historical bracket for a past season
export function generateHistoricalBracket(leagueId: string, season: number): PlayoffBracket {
  // Generate a completed bracket for historical seasons
  const teams = mockPlayoffTeams;

  // Shuffle winners based on season for variety
  const championIndex = season % 6;
  const runnerUpIndex = (championIndex + 1) % 6;

  const round1Matchups: BracketMatchup[] = [
    {
      id: `${season}-matchup-r1-1`,
      roundIndex: 0,
      matchupIndex: 0,
      homeTeam: {
        team: teams[2]!,
        score: 115.3 + (season % 10),
        isWinner: championIndex === 2,
      },
      awayTeam: {
        team: teams[5]!,
        score: 108.7 + (season % 8),
        isWinner: championIndex === 5,
      },
      isComplete: true,
      winnerId: championIndex === 5 ? teams[5]!.id : teams[2]!.id,
      status: 'complete',
    },
    {
      id: `${season}-matchup-r1-2`,
      roundIndex: 0,
      matchupIndex: 1,
      homeTeam: {
        team: teams[3]!,
        score: 121.4 + (season % 7),
        isWinner: championIndex === 3,
      },
      awayTeam: {
        team: teams[4]!,
        score: 118.9 + (season % 5),
        isWinner: championIndex === 4,
      },
      isComplete: true,
      winnerId: championIndex === 3 ? teams[3]!.id : teams[4]!.id,
      status: 'complete',
    },
  ];

  const round2Matchups: BracketMatchup[] = [
    {
      id: `${season}-matchup-r2-1`,
      roundIndex: 1,
      matchupIndex: 0,
      homeTeam: {
        team: teams[0]!,
        score: 142.1 + (season % 12),
        isWinner: championIndex === 0,
      },
      awayTeam: {
        team: championIndex === 4 ? teams[4]! : teams[3]!,
        score: 128.5 + (season % 9),
        isWinner: championIndex === 4 || championIndex === 3,
      },
      isComplete: true,
      winnerId: championIndex === 0 ? teams[0]!.id : championIndex === 4 ? teams[4]!.id : teams[3]!.id,
      status: 'complete',
    },
    {
      id: `${season}-matchup-r2-2`,
      roundIndex: 1,
      matchupIndex: 1,
      homeTeam: {
        team: teams[1]!,
        score: 131.8 + (season % 11),
        isWinner: championIndex === 1,
      },
      awayTeam: {
        team: championIndex === 5 ? teams[5]! : teams[2]!,
        score: 135.2 + (season % 6),
        isWinner: championIndex === 5 || championIndex === 2,
      },
      isComplete: true,
      winnerId: championIndex === 1 ? teams[1]!.id : championIndex === 5 ? teams[5]!.id : teams[2]!.id,
      status: 'complete',
    },
  ];

  const championshipMatchup: BracketMatchup = {
    id: `${season}-matchup-r3-1`,
    roundIndex: 2,
    matchupIndex: 0,
    homeTeam: {
      team: teams[championIndex]!,
      score: 156.3 + (season % 15),
      isWinner: true,
    },
    awayTeam: {
      team: teams[runnerUpIndex]!,
      score: 148.7 + (season % 13),
      isWinner: false,
    },
    isComplete: true,
    winnerId: teams[championIndex]!.id,
    status: 'complete',
  };

  const rounds: BracketRound[] = [
    { index: 0, name: 'Quarterfinals', matchups: round1Matchups, isCurrent: false },
    { index: 1, name: 'Semifinals', matchups: round2Matchups, isCurrent: false },
    { index: 2, name: 'Championship', matchups: [championshipMatchup], isCurrent: false },
  ];

  return {
    id: `bracket-${season}`,
    leagueId,
    season,
    type: 'winners',
    rounds,
    champion: teams[championIndex]!,
    playoffsStartWeek: 14,
    currentRoundIndex: 2,
  };
}

// Available seasons for mock data
export const mockAvailableSeasons = [2024, 2023, 2022, 2021, 2020];

// Mock response for bracket API
export function getMockBracketResponse(
  leagueId: string,
  hasStarted = true,
  isComplete = false,
  season?: number
): BracketResponse {
  const targetSeason = season || 2024;
  const isCurrentSeason = targetSeason === 2024;

  if (!hasStarted && isCurrentSeason) {
    return {
      playoffsStartWeek: 14,
      hasStarted: false,
      currentWeek: 12,
      bracket: null,
      hasConsolation: true,
      availableSeasons: mockAvailableSeasons,
      season: targetSeason,
    };
  }

  // Historical season - always complete
  if (!isCurrentSeason) {
    return {
      playoffsStartWeek: 14,
      hasStarted: true,
      currentWeek: 17,
      bracket: generateHistoricalBracket(leagueId, targetSeason),
      consolationBracket: generateConsolationBracket(leagueId, true),
      hasConsolation: true,
      availableSeasons: mockAvailableSeasons,
      season: targetSeason,
    };
  }

  return {
    playoffsStartWeek: 14,
    hasStarted: true,
    currentWeek: isComplete ? 17 : 15,
    bracket: isComplete ? generateMockBracket(leagueId) : generateInProgressBracket(leagueId),
    consolationBracket: generateConsolationBracket(leagueId, isComplete),
    hasConsolation: true,
    availableSeasons: mockAvailableSeasons,
    season: targetSeason,
  };
}
