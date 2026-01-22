// Pick'ems seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/pickems/. Types are defined
// in src/types/pickems.ts; this file provides fallback/seed data for testing.

import { mockTeams } from './teams';

import type { PickDistribution, PickemMatchup, RevealedPick, UserPick } from '@/types/pickems';

// Mock user names for revealed picks
const MOCK_USERS = [
  { id: 'user-1', name: 'John' },
  { id: 'user-2', name: 'Jane' },
  { id: 'user-3', name: 'Bob' },
  { id: 'user-4', name: 'Alice' },
  { id: 'user-5', name: 'Charlie' },
  { id: 'user-6', name: 'Diana' },
  { id: 'user-7', name: 'Eve' },
  { id: 'user-8', name: 'Frank' },
  { id: 'user-9', name: 'Grace' },
  { id: 'user-10', name: 'Henry' },
  { id: 'user-11', name: 'Iris' },
  { id: 'user-12', name: 'Jack' },
];

// Generate mock picks for locked matchups (simulates other users' picks)
function generateRevealedPicks(homeTeamId: string, awayTeamId: string): RevealedPick[] {
  const picks: RevealedPick[] = [];
  // Each user randomly picks home or away team
  for (const user of MOCK_USERS) {
    const teamId = Math.random() > 0.4 ? homeTeamId : awayTeamId; // Slight bias for home team
    picks.push({
      userId: user.id,
      userName: user.name,
      teamId,
    });
  }
  return picks;
}

// Generate pick distribution from revealed picks
function generateDistribution(picks: RevealedPick[], homeTeamId: string, awayTeamId: string): PickDistribution {
  const distribution: PickDistribution = {
    [homeTeamId]: 0,
    [awayTeamId]: 0,
  };
  for (const pick of picks) {
    const count = distribution[pick.teamId];
    if (count !== undefined) {
      distribution[pick.teamId] = count + 1;
    }
  }
  return distribution;
}

// Generate lock times - set some matchups to lock soon for countdown testing
function generateLockTime(hoursFromNow: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
}

// Generate mock matchups for pick'ems
export function generatePickemMatchups(leagueSlug: string, weekNumber: number): PickemMatchup[] {
  const teams = [...mockTeams];
  const matchups: PickemMatchup[] = [];
  const now = new Date();

  // Pair teams (first with last, second with second-to-last, etc.)
  for (let i = 0; i < Math.floor(teams.length / 2); i++) {
    const homeTeam = teams[i];
    const awayTeam = teams[teams.length - 1 - i];

    if (!homeTeam || !awayTeam) continue;

    // Spread lock times - ensure first matchups are unlocked for testing
    // First 3 matchups lock in 2-6 hours (unlocked), one at 30min (countdown), rest locked
    let hoursToLock: number;
    if (i < 3) {
      hoursToLock = 2 + i * 2; // 2hr, 4hr, 6hr - unlocked and enabled
    } else if (i === 3) {
      hoursToLock = 0.5; // 30 min - for countdown timer testing
    } else {
      hoursToLock = -1; // Already locked
    }
    const lockTime = generateLockTime(hoursToLock);
    const isLocked = new Date(lockTime) <= now;

    // Generate revealed picks and distribution for locked matchups
    let picks: RevealedPick[] | undefined;
    let distribution: PickDistribution | undefined;

    if (isLocked) {
      picks = generateRevealedPicks(homeTeam.id, awayTeam.id);
      distribution = generateDistribution(picks, homeTeam.id, awayTeam.id);
    }

    matchups.push({
      id: `pickem-${leagueSlug}-week${weekNumber}-matchup-${i + 1}`,
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
      weekNumber,
      lockTime,
      isLocked,
      picks, // Revealed picks for locked matchups
      distribution, // Pick distribution for locked matchups
    });
  }

  return matchups;
}

// Store for persisting user picks (in-memory for mock)
const picksStore = new Map<string, UserPick[]>();

function getPicksKey(leagueSlug: string, weekNumber: number, userId: string): string {
  return `${leagueSlug}-week-${weekNumber}-user-${userId}`;
}

export function getStoredPicks(leagueSlug: string, weekNumber: number, userId = 'current-user'): UserPick[] {
  const key = getPicksKey(leagueSlug, weekNumber, userId);
  return picksStore.get(key) || [];
}

export function storePicks(leagueSlug: string, weekNumber: number, picks: UserPick[], userId = 'current-user'): void {
  const key = getPicksKey(leagueSlug, weekNumber, userId);
  picksStore.set(key, picks);
}

export function updatePick(
  leagueSlug: string,
  weekNumber: number,
  matchupId: string,
  selectedTeamId: string,
  userId = 'current-user'
): UserPick[] {
  const currentPicks = getStoredPicks(leagueSlug, weekNumber, userId);

  // Remove any existing pick for this matchup
  const filteredPicks = currentPicks.filter((p) => p.matchupId !== matchupId);

  // Add new pick
  const newPick: UserPick = {
    matchupId,
    selectedTeamId,
    submittedAt: new Date().toISOString(),
  };

  const updatedPicks = [...filteredPicks, newPick];
  storePicks(leagueSlug, weekNumber, updatedPicks, userId);

  return updatedPicks;
}

// Mock constants
export const CURRENT_WEEK = 10;
export const TOTAL_WEEKS = 17;

// Generate graded matchups for completed weeks (seed data generator)
// NOTE: Real grading uses Prisma in src/data/matchups/grade-predictions.ts
export function generateGradedMatchups(leagueSlug: string, weekNumber: number, userPicks: UserPick[]): PickemMatchup[] {
  const teams = [...mockTeams];
  const matchups: PickemMatchup[] = [];

  // Use a seeded approach based on week to get consistent results
  const seed = weekNumber * 1000;

  // Pair teams (first with last, second with second-to-last, etc.)
  for (let i = 0; i < Math.floor(teams.length / 2); i++) {
    const homeTeam = teams[i];
    const awayTeam = teams[teams.length - 1 - i];

    if (!homeTeam || !awayTeam) continue;

    const matchupId = `pickem-${leagueSlug}-week${weekNumber}-matchup-${i + 1}`;

    // Generate mock final scores (use deterministic values based on matchup index and week)
    const homeScore = 80 + ((seed + i * 13) % 60);
    const awayScore = 80 + ((seed + i * 17 + 5) % 60);

    // Determine winner based on scores
    const winnerId = homeScore > awayScore ? homeTeam.id : awayTeam.id;

    // Check if user picked this matchup
    const userPick = userPicks.find((p) => p.matchupId === matchupId);
    const userPickedTeam = userPick?.selectedTeamId;

    // Determine if pick was correct
    const isCorrect = userPickedTeam ? userPickedTeam === winnerId : undefined;

    // Simulate stat corrections for some matchups (every 5th matchup has correction)
    const hasStatCorrection = i % 5 === 4;

    matchups.push({
      id: matchupId,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        ownerUsername: homeTeam.ownerUsername,
        avatarUrl: homeTeam.avatarUrl,
        record: homeTeam.record,
        score: homeScore,
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        ownerUsername: awayTeam.ownerUsername,
        avatarUrl: awayTeam.avatarUrl,
        record: awayTeam.record,
        score: awayScore,
      },
      weekNumber,
      lockTime: new Date(0).toISOString(), // Past locked time
      isLocked: true,
      isComplete: true,
      winnerId,
      userPick: userPickedTeam,
      isCorrect,
      hasStatCorrection,
    });
  }

  return matchups;
}
