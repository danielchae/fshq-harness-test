// Power rankings type definitions and seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/power-rankings/. These types
// are exported for ranking components; mock data provides fallback/seeding.

import { demoLeagueTeams, mockTeams } from './teams';

export interface TeamRanking {
  id: string;
  teamId: string;
  teamName: string;
  ownerUsername: string;
  avatarUrl?: string;
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
  rank: number;
  previousRank?: number;
  commentary: string;
}

export interface PowerRankingsData {
  id: string;
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  rankings: TeamRanking[];
  status: 'draft' | 'published';
  lastSaved: string;
  publishedAt?: string;
}

// Generate mock rankings from teams fixture, sorted by wins (descending)
function generateMockRankings(): TeamRanking[] {
  const sortedTeams = [...mockTeams].sort((a, b) => {
    const aWinPct = a.record.wins / (a.record.wins + a.record.losses + a.record.ties || 1);
    const bWinPct = b.record.wins / (b.record.wins + b.record.losses + b.record.ties || 1);
    return bWinPct - aWinPct;
  });

  return sortedTeams.map((team, index) => ({
    id: `ranking-${team.id}`,
    teamId: team.id,
    teamName: team.name,
    ownerUsername: team.ownerUsername,
    avatarUrl: team.avatarUrl,
    record: team.record,
    rank: index + 1,
    previousRank: index + 1 + (index % 3 === 0 ? 1 : index % 3 === 1 ? -1 : 0), // Simulate some movement
    commentary: getMockCommentary(index),
  }));
}

function getMockCommentary(rank: number): string {
  const commentaries = [
    'Dominant performance this week with stellar quarterback play and a defense that allowed fewer than 10 points.',
    'Solid victory but some concerns remain about the secondary. Need to tighten up pass coverage.',
    'Impressive comeback win shows this team has championship resilience. Watch out for them in playoffs.',
    'Consistent performer week after week. Not flashy but gets the job done reliably.',
    'Struggling to find rhythm after key injuries. Next few weeks will be crucial for playoff hopes.',
    'Underwhelming performance against a weaker opponent. Expected more from this talented roster.',
  ];
  return commentaries[rank % commentaries.length] || '';
}

export const mockPowerRankings: PowerRankingsData = {
  id: 'pr-week-3',
  leagueSlug: 'test-league',
  seasonId: 'season-2025',
  weekNumber: 3,
  rankings: generateMockRankings(),
  status: 'draft',
  lastSaved: new Date().toISOString(),
};

// Demo league power rankings - 3 weeks with commissioner commentary per team
// Week 1 commentaries
const week1Commentaries: Record<string, string> = {
  'demo-team-1':
    'The Bayou Bengals came out of the gate strong with a dominant Week 1 performance. Their offense looks unstoppable.',
  'demo-team-2': 'Metro Mustangs showed excellent form in the opener. Keep an eye on this squad.',
  'demo-team-3': 'Coastal Condors had a solid showing but left some points on the table. Room for improvement.',
  'demo-team-4': 'Mountain Mavericks surprised everyone with their balanced attack. A team to watch this season.',
  'demo-team-5': 'Lakeside Lions showed promise but need more consistency from their WR corps.',
  'demo-team-6': 'Desert Dragons had a tough matchup but competed well. Better days ahead.',
  'demo-team-7': 'Valley Vikings struggled early but showed some fight in the second half.',
  'demo-team-8': 'Harbor Hawks need to find their identity. Lots of talent but lacks cohesion.',
  'demo-team-9': 'Prairie Panthers had a rough opener but the schedule gets easier.',
  'demo-team-10': 'River Raptors looking for answers after a disappointing Week 1.',
  'demo-team-11': 'Summit Sharks have work to do. Injuries hampered their gameplan.',
  'demo-team-12': 'Timber Titans face an uphill battle. Need to rally quickly.',
};

// Week 2 commentaries
const week2Commentaries: Record<string, string> = {
  'demo-team-1': 'Bayou Bengals continue their dominance. Two straight wins with 150+ points each week.',
  'demo-team-2': 'Metro Mustangs bounce back from a close call with a convincing victory.',
  'demo-team-3': 'Coastal Condors clinch another win. Their RB room is carrying the load.',
  'demo-team-4': 'Mountain Mavericks prove Week 1 was no fluke. Playoff caliber squad.',
  'demo-team-5': 'Lakeside Lions split the first two weeks. Inconsistency remains a concern.',
  'demo-team-6': 'Desert Dragons get their first win. The trade for Achane looks genius.',
  'demo-team-7': 'Valley Vikings drop another close one. Need to close out games.',
  'demo-team-8': 'Harbor Hawks showing signs of life. Young core gaining experience.',
  'demo-team-9': 'Prairie Panthers still searching for answers. Tough stretch continues.',
  'demo-team-10': 'River Raptors found a spark this week. Is a turnaround coming?',
  'demo-team-11': 'Summit Sharks face adversity but showed heart in a close loss.',
  'demo-team-12': 'Timber Titans still winless but the effort is there. Keep grinding.',
};

// Week 3 commentaries
const week3Commentaries: Record<string, string> = {
  'demo-team-1': 'Bayou Bengals are the team to beat. Three straight dominant performances cement their status.',
  'demo-team-2': 'Metro Mustangs locked in for playoffs. Consistent excellence from this well-managed squad.',
  'demo-team-3': 'Coastal Condors riding a two-game streak. Their defense has been stellar.',
  'demo-team-4': 'Mountain Mavericks bounced back after a tough Week 2. Resilient bunch.',
  'demo-team-5': 'Lakeside Lions at .500 and looking to break through. Talent is there.',
  'demo-team-6': 'Desert Dragons heating up. Won two of last three with strong RB play.',
  'demo-team-7': 'Valley Vikings showing improvement but still below playoff line.',
  'demo-team-8': 'Harbor Hawks continue to battle. A win would do wonders for morale.',
  'demo-team-9': 'Prairie Panthers showing fight despite the record. Better days coming.',
  'demo-team-10': 'River Raptors trending up after back-to-back competitive games.',
  'demo-team-11': 'Summit Sharks need a win badly. Schedule lightens up soon.',
  'demo-team-12': 'Timber Titans still searching for that first win. Stay patient.',
};

// Generate demo league rankings for a specific week
function generateDemoLeagueRankings(weekNumber: number): TeamRanking[] {
  // Simulate different rankings per week by shuffling slightly
  const rankOrder = [
    // Week 1: Initial standings
    [
      'demo-team-1',
      'demo-team-2',
      'demo-team-3',
      'demo-team-4',
      'demo-team-5',
      'demo-team-6',
      'demo-team-7',
      'demo-team-8',
      'demo-team-9',
      'demo-team-10',
      'demo-team-11',
      'demo-team-12',
    ],
    // Week 2: Some movement
    [
      'demo-team-1',
      'demo-team-2',
      'demo-team-4',
      'demo-team-3',
      'demo-team-6',
      'demo-team-5',
      'demo-team-8',
      'demo-team-7',
      'demo-team-10',
      'demo-team-9',
      'demo-team-11',
      'demo-team-12',
    ],
    // Week 3: More movement
    [
      'demo-team-1',
      'demo-team-2',
      'demo-team-3',
      'demo-team-4',
      'demo-team-5',
      'demo-team-6',
      'demo-team-7',
      'demo-team-8',
      'demo-team-9',
      'demo-team-10',
      'demo-team-11',
      'demo-team-12',
    ],
  ];

  const previousRankOrder = weekNumber > 1 ? rankOrder[weekNumber - 2] : null;
  const currentOrder = rankOrder[weekNumber - 1] ?? rankOrder[0];

  const commentaries = weekNumber === 1 ? week1Commentaries : weekNumber === 2 ? week2Commentaries : week3Commentaries;

  // TypeScript safety: currentOrder is always defined due to fallback above
  if (!currentOrder) {
    return [];
  }

  const rankings: TeamRanking[] = [];

  for (let index = 0; index < currentOrder.length; index++) {
    const teamId = currentOrder[index];
    if (!teamId) {
      continue;
    }
    const team = demoLeagueTeams.find((t) => t.id === teamId);
    if (!team) {
      // Should never happen with valid data, but skip if team not found
      continue;
    }
    const previousRank = previousRankOrder ? previousRankOrder.indexOf(teamId) + 1 : undefined;

    const ranking: TeamRanking = {
      id: `demo-ranking-week${weekNumber}-${team.id}`,
      teamId: team.id,
      teamName: team.name,
      ownerUsername: team.ownerUsername,
      record: team.record,
      rank: index + 1,
      commentary: commentaries[team.id] || 'No commentary available.',
    };

    if (team.avatarUrl) {
      ranking.avatarUrl = team.avatarUrl;
    }

    if (previousRank !== undefined) {
      ranking.previousRank = previousRank;
    }

    rankings.push(ranking);
  }

  return rankings;
}

// Pre-generated demo league power rankings for 3 weeks
export const demoLeagueWeek1Rankings: PowerRankingsData = {
  id: 'demo-pr-week-1',
  leagueSlug: 'demo-league',
  seasonId: 'season-2026',
  weekNumber: 1,
  rankings: generateDemoLeagueRankings(1),
  status: 'published',
  lastSaved: '2026-01-03T08:00:00Z',
  publishedAt: '2026-01-03T08:00:00Z',
};

export const demoLeagueWeek2Rankings: PowerRankingsData = {
  id: 'demo-pr-week-2',
  leagueSlug: 'demo-league',
  seasonId: 'season-2026',
  weekNumber: 2,
  rankings: generateDemoLeagueRankings(2),
  status: 'published',
  lastSaved: '2026-01-10T08:00:00Z',
  publishedAt: '2026-01-10T08:00:00Z',
};

export const demoLeagueWeek3Rankings: PowerRankingsData = {
  id: 'demo-pr-week-3',
  leagueSlug: 'demo-league',
  seasonId: 'season-2026',
  weekNumber: 3,
  rankings: generateDemoLeagueRankings(3),
  status: 'published',
  lastSaved: '2026-01-17T08:00:00Z',
  publishedAt: '2026-01-17T08:00:00Z',
};

// For persistence simulation - stores rankings by league/week key
const rankingsStore = new Map<string, PowerRankingsData>();

export function getPowerRankingsKey(leagueSlug: string, weekNumber: number): string {
  return `${leagueSlug}-week-${weekNumber}`;
}

export function getStoredRankings(leagueSlug: string, weekNumber: number): PowerRankingsData | null {
  const key = getPowerRankingsKey(leagueSlug, weekNumber);
  return rankingsStore.get(key) || null;
}

export function storeRankings(data: PowerRankingsData): void {
  const key = getPowerRankingsKey(data.leagueSlug, data.weekNumber);
  rankingsStore.set(key, data);
}

// Initialize with mock data
storeRankings(mockPowerRankings);
storeRankings(demoLeagueWeek1Rankings);
storeRankings(demoLeagueWeek2Rankings);
storeRankings(demoLeagueWeek3Rankings);
