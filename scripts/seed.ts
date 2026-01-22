/**
 * Database Seed Script for Development
 *
 * Creates realistic test data matching frontend fixtures:
 * - Users with various roles
 * - Leagues (test-league, demo-league, dynasty-legends, new-league)
 * - Teams with records
 * - League memberships with different roles and statuses
 * - Moments (posts, trades, rankings, transactions, pickems)
 * - Comments with threading
 * - Reactions
 * - Power rankings with entries
 * - Matchups and predictions
 * - Pick'em entries
 * - Transactions
 * - Season history
 * - Engagement metrics
 *
 * Run with: pnpm db:seed or npx prisma db seed
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Constants
const CURRENT_SEASON = 2025;
const CURRENT_WEEK = 3;

// ============================================================================
// USER DATA
// ============================================================================

interface UserData {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl?: string;
}

const testUsers: UserData[] = [
  // System test users
  {
    id: 'test-user',
    email: 'test@samus.ai',
    name: 'Test User',
    username: 'testuser',
    avatarUrl: 'https://picsum.photos/seed/testuser/80/80',
  },
  {
    id: 'donny-user',
    email: 'donny@samus.ai',
    name: 'Donny',
    username: 'donny',
    avatarUrl: 'https://picsum.photos/seed/donny/80/80',
  },
  // Test league users (user-1 through user-10)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `user-${i + 1}`,
    email: `user${i + 1}@example.com`,
    name: `User ${i + 1}`,
    username: `user${i + 1}`,
    avatarUrl: `https://picsum.photos/seed/user${i + 1}/80/80`,
  })),
];

// Demo league users matching fixture data
const demoUsers: UserData[] = [
  {
    id: 'demo-user-1',
    email: 'john@example.com',
    name: 'John Smith',
    username: 'john_smith',
    avatarUrl: 'https://picsum.photos/seed/john/80/80',
  },
  {
    id: 'demo-user-2',
    email: 'jane@example.com',
    name: 'Jane Doe',
    username: 'jane_doe',
    avatarUrl: 'https://picsum.photos/seed/jane/80/80',
  },
  {
    id: 'demo-user-3',
    email: 'bob@example.com',
    name: 'Bob Johnson',
    username: 'bob_johnson',
    avatarUrl: 'https://picsum.photos/seed/bob/80/80',
  },
  {
    id: 'demo-user-4',
    email: 'alice@example.com',
    name: 'Alice Williams',
    username: 'alice_williams',
    avatarUrl: 'https://picsum.photos/seed/alice/80/80',
  },
  {
    id: 'demo-user-5',
    email: 'charlie@example.com',
    name: 'Charlie Brown',
    username: 'charlie_brown',
    avatarUrl: 'https://picsum.photos/seed/charlie/80/80',
  },
  {
    id: 'demo-user-6',
    email: 'diana@example.com',
    name: 'Diana Ross',
    username: 'diana_ross',
    avatarUrl: 'https://picsum.photos/seed/diana/80/80',
  },
  {
    id: 'demo-user-7',
    email: 'eve@example.com',
    name: 'Eve Miller',
    username: 'eve_miller',
    avatarUrl: 'https://picsum.photos/seed/eve/80/80',
  },
  {
    id: 'demo-user-8',
    email: 'frank@example.com',
    name: 'Frank Garcia',
    username: 'frank_garcia',
    avatarUrl: 'https://picsum.photos/seed/frank/80/80',
  },
  {
    id: 'demo-user-9',
    email: 'grace@example.com',
    name: 'Grace Lee',
    username: 'grace_lee',
    avatarUrl: 'https://picsum.photos/seed/grace/80/80',
  },
  {
    id: 'demo-user-10',
    email: 'henry@example.com',
    name: 'Henry Wilson',
    username: 'henry_wilson',
    avatarUrl: 'https://picsum.photos/seed/henry/80/80',
  },
  {
    id: 'demo-user-11',
    email: 'iris@example.com',
    name: 'Iris Chen',
    username: 'iris_chen',
    avatarUrl: 'https://picsum.photos/seed/iris/80/80',
  },
  {
    id: 'demo-user-12',
    email: 'jack@example.com',
    name: 'Jack Taylor',
    username: 'jack_taylor',
    avatarUrl: 'https://picsum.photos/seed/jack/80/80',
  },
  // Fan users (no teams)
  {
    id: 'demo-user-13',
    email: 'kelly@example.com',
    name: 'Kelly Martinez',
    username: 'kelly_martinez',
    avatarUrl: 'https://picsum.photos/seed/kelly/80/80',
  },
  {
    id: 'demo-user-14',
    email: 'liam@example.com',
    name: 'Liam Anderson',
    username: 'liam_anderson',
    avatarUrl: 'https://picsum.photos/seed/liam/80/80',
  },
  {
    id: 'demo-user-15',
    email: 'mia@example.com',
    name: 'Mia Thompson',
    username: 'mia_thompson',
    avatarUrl: 'https://picsum.photos/seed/mia/80/80',
  },
  {
    id: 'demo-user-16',
    email: 'noah@example.com',
    name: 'Noah Davis',
    username: 'noah_davis',
    avatarUrl: 'https://picsum.photos/seed/noah/80/80',
  },
];

const allUsers = [...testUsers, ...demoUsers];

// ============================================================================
// LEAGUE DATA
// ============================================================================

interface LeagueData {
  id: string;
  slug: string;
  name: string;
  description: string;
  teamCount: number;
  season: number;
  platform: 'sleeper' | 'espn' | 'yahoo';
  visibility: 'public' | 'private';
  joinRule: 'auto_join' | 'approval_required';
  creatorId: string;
  avatarUrl?: string;
  isDynasty?: boolean;
}

const leagues: LeagueData[] = [
  {
    id: 'league-1',
    slug: 'test-league',
    name: 'Test League',
    description: 'A test fantasy football league for development',
    teamCount: 10,
    season: CURRENT_SEASON,
    platform: 'sleeper',
    visibility: 'private',
    joinRule: 'approval_required',
    creatorId: 'user-1',
    avatarUrl: 'https://picsum.photos/seed/league1/100/100',
  },
  {
    id: 'league-2',
    slug: 'dynasty-legends',
    name: 'Dynasty Legends',
    description: 'Dynasty fantasy football league',
    teamCount: 10,
    season: CURRENT_SEASON,
    platform: 'sleeper',
    visibility: 'private',
    joinRule: 'approval_required',
    creatorId: 'user-1',
    avatarUrl: 'https://picsum.photos/seed/league2/100/100',
    isDynasty: true,
  },
  {
    id: 'league-3',
    slug: 'demo-league',
    name: 'Demo League',
    description: 'Demo fantasy football league for testing',
    teamCount: 12,
    season: CURRENT_SEASON,
    platform: 'sleeper',
    visibility: 'public',
    joinRule: 'auto_join',
    creatorId: 'demo-user-1',
    avatarUrl: 'https://picsum.photos/seed/demoleague/100/100',
  },
  {
    id: 'league-4',
    slug: 'new-league',
    name: 'New League',
    description: 'A brand new league with no history',
    teamCount: 10,
    season: CURRENT_SEASON,
    platform: 'sleeper',
    visibility: 'public',
    joinRule: 'auto_join',
    creatorId: 'demo-user-1',
    avatarUrl: 'https://picsum.photos/seed/newleague/100/100',
  },
];

// ============================================================================
// TEAM DATA
// ============================================================================

interface TeamData {
  id: string;
  leagueId: string;
  name: string;
  ownerUsername: string;
  managerId: string;
  wins: number;
  losses: number;
  ties: number;
  isClaimed: boolean;
  claimedBy?: string;
  avatarUrl?: string;
}

// Test league teams
const testLeagueTeams: TeamData[] = [
  {
    id: 'team-1',
    leagueId: 'league-1',
    name: 'Touchdown Titans',
    ownerUsername: 'johndoe123',
    managerId: 'user-1',
    wins: 8,
    losses: 4,
    ties: 0,
    isClaimed: false,
    avatarUrl: 'https://picsum.photos/seed/team1/100/100',
  },
  {
    id: 'team-2',
    leagueId: 'league-1',
    name: 'Fantasy Champions',
    ownerUsername: 'janedoe456',
    managerId: 'user-2',
    wins: 7,
    losses: 5,
    ties: 0,
    isClaimed: true,
    claimedBy: 'user-2',
    avatarUrl: 'https://picsum.photos/seed/team2/100/100',
  },
  {
    id: 'team-3',
    leagueId: 'league-1',
    name: 'Gridiron Warriors',
    ownerUsername: 'mike_fantasy',
    managerId: 'user-3',
    wins: 10,
    losses: 2,
    ties: 0,
    isClaimed: false,
    avatarUrl: 'https://picsum.photos/seed/team3/100/100',
  },
  {
    id: 'team-4',
    leagueId: 'league-1',
    name: 'Sunday Slayers',
    ownerUsername: 'sarah_wins',
    managerId: 'user-4',
    wins: 6,
    losses: 6,
    ties: 0,
    isClaimed: false,
    avatarUrl: 'https://picsum.photos/seed/team4/100/100',
  },
  {
    id: 'team-5',
    leagueId: 'league-1',
    name: 'Dynasty Dominators',
    ownerUsername: 'tom_brady_fan',
    managerId: 'user-5',
    wins: 5,
    losses: 7,
    ties: 0,
    isClaimed: true,
    claimedBy: 'user-5',
    avatarUrl: 'https://picsum.photos/seed/team5/100/100',
  },
  {
    id: 'team-6',
    leagueId: 'league-1',
    name: 'End Zone Experts',
    ownerUsername: 'fantasy_guru99',
    managerId: 'user-6',
    wins: 9,
    losses: 3,
    ties: 0,
    isClaimed: false,
    avatarUrl: 'https://picsum.photos/seed/team6/100/100',
  },
  {
    id: 'team-7',
    leagueId: 'league-1',
    name: 'Red Zone Raiders',
    ownerUsername: 'redzone_pro',
    managerId: 'user-7',
    wins: 7,
    losses: 5,
    ties: 0,
    isClaimed: false,
    avatarUrl: 'https://picsum.photos/seed/team7/100/100',
  },
  {
    id: 'team-8',
    leagueId: 'league-1',
    name: 'Monday Night Masters',
    ownerUsername: 'monday_night',
    managerId: 'user-8',
    wins: 4,
    losses: 8,
    ties: 0,
    isClaimed: false,
    avatarUrl: 'https://picsum.photos/seed/team8/100/100',
  },
  {
    id: 'team-9',
    leagueId: 'league-1',
    name: 'Playoff Pushers',
    ownerUsername: 'playoffs_or_bust',
    managerId: 'user-9',
    wins: 6,
    losses: 6,
    ties: 0,
    isClaimed: false,
    avatarUrl: 'https://picsum.photos/seed/team9/100/100',
  },
  {
    id: 'team-10',
    leagueId: 'league-1',
    name: 'Championship Chasers',
    ownerUsername: 'champ_chase',
    managerId: 'user-10',
    wins: 8,
    losses: 4,
    ties: 0,
    isClaimed: false,
    avatarUrl: 'https://picsum.photos/seed/team10/100/100',
  },
];

// Demo league teams (12 teams)
const demoLeagueTeams: TeamData[] = [
  {
    id: 'demo-team-1',
    leagueId: 'league-3',
    name: 'Bayou Bengals',
    ownerUsername: 'john_smith',
    managerId: 'demo-user-1',
    wins: 10,
    losses: 3,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-1',
    avatarUrl: 'https://picsum.photos/seed/demoteam1/100/100',
  },
  {
    id: 'demo-team-2',
    leagueId: 'league-3',
    name: 'Metro Mustangs',
    ownerUsername: 'jane_doe',
    managerId: 'demo-user-2',
    wins: 9,
    losses: 4,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-2',
    avatarUrl: 'https://picsum.photos/seed/demoteam2/100/100',
  },
  {
    id: 'demo-team-3',
    leagueId: 'league-3',
    name: 'Coastal Condors',
    ownerUsername: 'bob_johnson',
    managerId: 'demo-user-3',
    wins: 8,
    losses: 5,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-3',
    avatarUrl: 'https://picsum.photos/seed/demoteam3/100/100',
  },
  {
    id: 'demo-team-4',
    leagueId: 'league-3',
    name: 'Mountain Mavericks',
    ownerUsername: 'alice_williams',
    managerId: 'demo-user-4',
    wins: 8,
    losses: 5,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-4',
    avatarUrl: 'https://picsum.photos/seed/demoteam4/100/100',
  },
  {
    id: 'demo-team-5',
    leagueId: 'league-3',
    name: 'Lakeside Lions',
    ownerUsername: 'charlie_brown',
    managerId: 'demo-user-5',
    wins: 7,
    losses: 6,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-5',
    avatarUrl: 'https://picsum.photos/seed/demoteam5/100/100',
  },
  {
    id: 'demo-team-6',
    leagueId: 'league-3',
    name: 'Desert Dragons',
    ownerUsername: 'diana_ross',
    managerId: 'demo-user-6',
    wins: 7,
    losses: 6,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-6',
    avatarUrl: 'https://picsum.photos/seed/demoteam6/100/100',
  },
  {
    id: 'demo-team-7',
    leagueId: 'league-3',
    name: 'Valley Vikings',
    ownerUsername: 'eve_miller',
    managerId: 'demo-user-7',
    wins: 6,
    losses: 7,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-7',
    avatarUrl: 'https://picsum.photos/seed/demoteam7/100/100',
  },
  {
    id: 'demo-team-8',
    leagueId: 'league-3',
    name: 'Harbor Hawks',
    ownerUsername: 'frank_garcia',
    managerId: 'demo-user-8',
    wins: 6,
    losses: 7,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-8',
    avatarUrl: 'https://picsum.photos/seed/demoteam8/100/100',
  },
  {
    id: 'demo-team-9',
    leagueId: 'league-3',
    name: 'Prairie Panthers',
    ownerUsername: 'grace_lee',
    managerId: 'demo-user-9',
    wins: 5,
    losses: 8,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-9',
    avatarUrl: 'https://picsum.photos/seed/demoteam9/100/100',
  },
  {
    id: 'demo-team-10',
    leagueId: 'league-3',
    name: 'River Raptors',
    ownerUsername: 'henry_wilson',
    managerId: 'demo-user-10',
    wins: 5,
    losses: 8,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-10',
    avatarUrl: 'https://picsum.photos/seed/demoteam10/100/100',
  },
  {
    id: 'demo-team-11',
    leagueId: 'league-3',
    name: 'Summit Sharks',
    ownerUsername: 'iris_chen',
    managerId: 'demo-user-11',
    wins: 4,
    losses: 9,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-11',
    avatarUrl: 'https://picsum.photos/seed/demoteam11/100/100',
  },
  {
    id: 'demo-team-12',
    leagueId: 'league-3',
    name: 'Timber Titans',
    ownerUsername: 'jack_taylor',
    managerId: 'demo-user-12',
    wins: 3,
    losses: 10,
    ties: 0,
    isClaimed: true,
    claimedBy: 'demo-user-12',
    avatarUrl: 'https://picsum.photos/seed/demoteam12/100/100',
  },
];

const allTeams = [...testLeagueTeams, ...demoLeagueTeams];

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

async function cleanupDatabase() {
  console.log('🧹 Cleaning up existing seed data...');

  // Delete in reverse order of foreign key dependencies
  await prisma.allTimeStats.deleteMany({});
  await prisma.seasonStats.deleteMany({});
  await prisma.weeklyStats.deleteMany({});
  await prisma.engagementMetrics.deleteMany({});
  await prisma.seasonHistory.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.pickemEntry.deleteMany({});
  await prisma.matchupPrediction.deleteMany({});
  await prisma.matchup.deleteMany({});
  await prisma.powerRankingEntry.deleteMany({});
  await prisma.powerRanking.deleteMany({});
  await prisma.reaction.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.moment.deleteMany({});
  await prisma.leagueSettings.deleteMany({});
  await prisma.leagueMembership.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.league.deleteMany({});

  // Delete seed users by both ID and email (to handle conflicts)
  const userIds = allUsers.map((u) => u.id);
  const userEmails = allUsers.map((u) => u.email);
  const usernames = allUsers.map((u) => u.username);
  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: { in: userIds } },
        { email: { in: userEmails } },
        { username: { in: usernames } },
      ],
    },
  });

  console.log('  ✓ Cleanup complete');
}

async function seedUsers() {
  console.log('👤 Seeding users...');
  const hashedPassword = await bcrypt.hash('12345', 12);

  for (const user of allUsers) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        password: hashedPassword,
        emailVerified: new Date(),
      },
    });
  }
  console.log(`  ✓ Created ${allUsers.length} users`);
}

async function seedLeagues() {
  console.log('🏆 Seeding leagues...');

  for (const league of leagues) {
    await prisma.league.upsert({
      where: { id: league.id },
      update: {},
      create: {
        id: league.id,
        slug: league.slug,
        name: league.name,
        description: league.description,
        teamCount: league.teamCount,
        season: league.season,
        platform: league.platform,
        visibility: league.visibility,
        joinRule: league.joinRule,
        creatorId: league.creatorId,
        avatarUrl: league.avatarUrl,
        isDynasty: league.isDynasty ?? false,
      },
    });
  }
  console.log(`  ✓ Created ${leagues.length} leagues`);
}

async function seedTeams() {
  console.log('🏈 Seeding teams...');

  for (const team of allTeams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: {},
      create: {
        id: team.id,
        leagueId: team.leagueId,
        name: team.name,
        ownerUsername: team.ownerUsername,
        sleeperUsername: team.ownerUsername,
        managerId: team.managerId,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
        isClaimed: team.isClaimed,
        claimedBy: team.claimedBy,
        avatarUrl: team.avatarUrl,
        currentSeason: CURRENT_SEASON,
      },
    });
  }
  console.log(`  ✓ Created ${allTeams.length} teams`);
}

async function seedLeagueMemberships() {
  console.log('👥 Seeding league memberships...');
  let count = 0;

  // Demo league memberships - matching fixture data
  const demoMemberships = [
    // Admin (1)
    {
      userId: 'demo-user-1',
      leagueId: 'league-3',
      role: 'admin' as const,
      teamId: 'demo-team-1',
    },
    // Commissioner (1)
    {
      userId: 'demo-user-2',
      leagueId: 'league-3',
      role: 'commissioner' as const,
      teamId: 'demo-team-2',
    },
    // Managers (10)
    ...Array.from({ length: 10 }, (_, i) => ({
      userId: `demo-user-${i + 3}`,
      leagueId: 'league-3',
      role: 'manager' as const,
      teamId: `demo-team-${i + 3}`,
    })),
    // Fans (4)
    ...Array.from({ length: 4 }, (_, i) => ({
      userId: `demo-user-${i + 13}`,
      leagueId: 'league-3',
      role: 'fan' as const,
      teamId: undefined,
    })),
  ];

  for (const membership of demoMemberships) {
    await prisma.leagueMembership.upsert({
      where: {
        user_league_unique: {
          userId: membership.userId,
          leagueId: membership.leagueId,
        },
      },
      update: {},
      create: {
        userId: membership.userId,
        leagueId: membership.leagueId,
        role: membership.role,
        status: 'approved',
        teamId: membership.teamId,
      },
    });
    count++;
  }

  // Test league memberships
  const testMemberships = [
    { userId: 'user-1', leagueId: 'league-1', role: 'commissioner' as const, teamId: 'team-1' },
    { userId: 'user-2', leagueId: 'league-1', role: 'admin' as const, teamId: 'team-2' },
    ...Array.from({ length: 8 }, (_, i) => ({
      userId: `user-${i + 3}`,
      leagueId: 'league-1',
      role: 'manager' as const,
      teamId: `team-${i + 3}`,
    })),
  ];

  for (const membership of testMemberships) {
    await prisma.leagueMembership.upsert({
      where: {
        user_league_unique: {
          userId: membership.userId,
          leagueId: membership.leagueId,
        },
      },
      update: {},
      create: {
        userId: membership.userId,
        leagueId: membership.leagueId,
        role: membership.role,
        status: 'approved',
        teamId: membership.teamId,
      },
    });
    count++;
  }

  console.log(`  ✓ Created ${count} league memberships`);
}

async function seedLeagueSettings() {
  console.log('⚙️ Seeding league settings...');

  for (const league of leagues) {
    await prisma.leagueSettings.upsert({
      where: { leagueId: league.id },
      update: {},
      create: {
        leagueId: league.id,
        pickemsEnabled: true,
        powerRankingsEnabled: true,
        bracketEnabled: true,
        fanAccessEnabled: true,
        fanLimit: league.id === 'league-3' ? 10 : null,
        currentFanCount: league.id === 'league-3' ? 4 : 0,
        description: league.description,
        publicContent: {
          rankings: true,
          matchups: true,
          brackets: true,
          transactions: false,
          history: true,
        },
      },
    });
  }
  console.log(`  ✓ Created ${leagues.length} league settings`);
}

async function seedMoments() {
  console.log('📝 Seeding moments...');
  let count = 0;

  // Demo league moments
  const demoMoments = [
    // Posts
    {
      id: 'demo-moment-1',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'post' as const,
      content: 'Welcome to the new season everyone! Excited to see how this year plays out.',
      createdAt: new Date('2026-01-18T10:00:00Z'),
    },
    {
      id: 'demo-moment-2',
      leagueId: 'league-3',
      authorId: 'demo-user-3',
      type: 'post' as const,
      content: 'That game last night was insane! My team barely pulled through.',
      createdAt: new Date('2026-01-17T22:30:00Z'),
    },
    {
      id: 'demo-moment-3',
      leagueId: 'league-3',
      authorId: 'demo-user-5',
      type: 'post' as const,
      content: 'Looking to make some moves before the deadline. Who wants to trade?',
      createdAt: new Date('2026-01-16T15:00:00Z'),
    },
    {
      id: 'demo-moment-4',
      leagueId: 'league-3',
      authorId: 'demo-user-4',
      type: 'post' as const,
      content: 'Just hit 1000 points scored this season! New personal record!',
      createdAt: new Date('2026-01-15T18:45:00Z'),
    },
    {
      id: 'demo-moment-5',
      leagueId: 'league-3',
      authorId: 'demo-user-7',
      type: 'post' as const,
      content: 'My team finally got a winning streak going. Three in a row!',
      createdAt: new Date('2026-01-14T20:00:00Z'),
    },
    {
      id: 'demo-moment-6',
      leagueId: 'league-3',
      authorId: 'demo-user-13',
      type: 'post' as const,
      content: 'Commissioner prediction was spot on this week. Impressive!',
      createdAt: new Date('2026-01-13T09:30:00Z'),
    },

    // Trades (stored as JSON content)
    {
      id: 'demo-moment-7',
      leagueId: 'league-3',
      authorId: 'demo-user-1',
      type: 'trade' as const,
      content: JSON.stringify({
        team1: 'Bayou Bengals',
        team2: 'Metro Mustangs',
        players1: ["Ja'Marr Chase", '2026 2nd'],
        players2: ['Justin Jefferson', '2026 4th'],
      }),
      createdAt: new Date('2026-01-17T14:00:00Z'),
    },
    {
      id: 'demo-moment-8',
      leagueId: 'league-3',
      authorId: 'demo-user-3',
      type: 'trade' as const,
      content: JSON.stringify({
        team1: 'Coastal Condors',
        team2: 'Mountain Mavericks',
        players1: ['Bijan Robinson'],
        players2: ['Breece Hall', '2026 3rd'],
      }),
      createdAt: new Date('2026-01-15T11:30:00Z'),
    },
    {
      id: 'demo-moment-9',
      leagueId: 'league-3',
      authorId: 'demo-user-5',
      type: 'trade' as const,
      content: JSON.stringify({
        team1: 'Lakeside Lions',
        team2: 'Desert Dragons',
        players1: ['Travis Kelce', '2027 1st'],
        players2: ['Mark Andrews', 'DeVonta Smith'],
      }),
      createdAt: new Date('2026-01-12T16:45:00Z'),
    },
    {
      id: 'demo-moment-10',
      leagueId: 'league-3',
      authorId: 'demo-user-7',
      type: 'trade' as const,
      content: JSON.stringify({
        team1: 'Valley Vikings',
        team2: 'Harbor Hawks',
        players1: ['Lamar Jackson'],
        players2: ['Jalen Hurts', '2026 1st'],
      }),
      createdAt: new Date('2026-01-10T13:00:00Z'),
    },
    {
      id: 'demo-moment-11',
      leagueId: 'league-3',
      authorId: 'demo-user-9',
      type: 'trade' as const,
      content: JSON.stringify({
        team1: 'Prairie Panthers',
        team2: 'River Raptors',
        players1: ['Tyreek Hill'],
        players2: ['DK Metcalf', 'Jaylen Waddle'],
      }),
      createdAt: new Date('2026-01-08T09:15:00Z'),
    },

    // Rankings
    {
      id: 'demo-moment-12',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'rankings' as const,
      content: 'Week 3 Power Rankings are live! Big shakeup this week.',
      createdAt: new Date('2026-01-17T08:00:00Z'),
    },
    {
      id: 'demo-moment-13',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'rankings' as const,
      content: 'Week 2 Power Rankings published. Some surprising moves!',
      createdAt: new Date('2026-01-10T08:00:00Z'),
    },
    {
      id: 'demo-moment-14',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'rankings' as const,
      content: 'Week 1 Power Rankings are here! Season opener analysis.',
      createdAt: new Date('2026-01-03T08:00:00Z'),
    },

    // Transactions
    {
      id: 'demo-moment-15',
      leagueId: 'league-3',
      authorId: 'demo-user-1',
      type: 'transaction' as const,
      content: 'Bayou Bengals adds Puka Nacua from waivers',
      createdAt: new Date('2026-01-18T06:00:00Z'),
    },
    {
      id: 'demo-moment-16',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'transaction' as const,
      content: 'Metro Mustangs drops Chris Olave, adds Romeo Doubs',
      createdAt: new Date('2026-01-16T07:30:00Z'),
    },
    {
      id: 'demo-moment-17',
      leagueId: 'league-3',
      authorId: 'demo-user-6',
      type: 'transaction' as const,
      content: "Desert Dragons claims De'Von Achane off waivers",
      createdAt: new Date('2026-01-14T06:45:00Z'),
    },
    {
      id: 'demo-moment-18',
      leagueId: 'league-3',
      authorId: 'demo-user-11',
      type: 'transaction' as const,
      content: 'Summit Sharks adds Sam LaPorta, drops Cole Kmet',
      createdAt: new Date('2026-01-11T08:00:00Z'),
    },

    // Pick'ems
    {
      id: 'demo-moment-19',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'pickems' as const,
      content: "Week 3 Pick'ems results are in! John Smith leads with 10-2 record.",
      createdAt: new Date('2026-01-17T23:00:00Z'),
    },
    {
      id: 'demo-moment-20',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'pickems' as const,
      content: "Week 2 Pick'ems wrapped up. Close competition this week!",
      createdAt: new Date('2026-01-10T23:00:00Z'),
    },
    {
      id: 'demo-moment-21',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'pickems' as const,
      content: "Week 1 Pick'ems are locked in. Good luck everyone!",
      createdAt: new Date('2026-01-03T12:00:00Z'),
    },
    {
      id: 'demo-moment-22',
      leagueId: 'league-3',
      authorId: 'demo-user-2',
      type: 'pickems' as const,
      content: "Season Pick'ems standings updated. Check the leaderboard!",
      createdAt: new Date('2026-01-18T00:00:00Z'),
    },
  ];

  for (const moment of demoMoments) {
    await prisma.moment.upsert({
      where: { id: moment.id },
      update: {},
      create: moment,
    });
    count++;
  }

  console.log(`  ✓ Created ${count} moments`);
}

async function seedComments() {
  console.log('💬 Seeding comments...');
  let count = 0;

  const comments = [
    // Comments for demo-moment-1
    {
      id: 'comment-1',
      content: "Can't wait for this season! Let's go!",
      authorId: 'demo-user-3',
      momentId: 'demo-moment-1',
      createdAt: new Date('2026-01-18T10:30:00Z'),
    },
    {
      id: 'comment-2',
      content: 'Same here! Already made some moves.',
      authorId: 'demo-user-4',
      momentId: 'demo-moment-1',
      parentId: 'comment-1',
      createdAt: new Date('2026-01-18T10:45:00Z'),
    },
    {
      id: 'comment-3',
      content: 'Good luck to everyone!',
      authorId: 'demo-user-5',
      momentId: 'demo-moment-1',
      createdAt: new Date('2026-01-18T11:00:00Z'),
    },

    // Comments for demo-moment-7 (big trade)
    {
      id: 'comment-4',
      content: 'Wow, blockbuster trade! Who won this?',
      authorId: 'demo-user-6',
      momentId: 'demo-moment-7',
      createdAt: new Date('2026-01-17T14:15:00Z'),
    },
    {
      id: 'comment-5',
      content: 'I think both teams did well honestly.',
      authorId: 'demo-user-7',
      momentId: 'demo-moment-7',
      parentId: 'comment-4',
      createdAt: new Date('2026-01-17T14:30:00Z'),
    },
    {
      id: 'comment-6',
      content: 'Jefferson side wins long term.',
      authorId: 'demo-user-8',
      momentId: 'demo-moment-7',
      parentId: 'comment-4',
      createdAt: new Date('2026-01-17T14:45:00Z'),
    },
    {
      id: 'comment-7',
      content: 'Bold move by both managers!',
      authorId: 'demo-user-13',
      momentId: 'demo-moment-7',
      createdAt: new Date('2026-01-17T15:00:00Z'),
    },

    // Comments for rankings moment
    {
      id: 'comment-8',
      content: 'I disagree with my ranking!',
      authorId: 'demo-user-12',
      momentId: 'demo-moment-12',
      createdAt: new Date('2026-01-17T08:30:00Z'),
    },
    {
      id: 'comment-9',
      content: "Rankings look fair to me. You'll move up with a win.",
      authorId: 'demo-user-2',
      momentId: 'demo-moment-12',
      parentId: 'comment-8',
      createdAt: new Date('2026-01-17T08:45:00Z'),
    },
  ];

  for (const comment of comments) {
    await prisma.comment.upsert({
      where: { id: comment.id },
      update: {},
      create: comment,
    });
    count++;
  }

  console.log(`  ✓ Created ${count} comments`);
}

async function seedReactions() {
  console.log('👍 Seeding reactions...');
  let count = 0;

  const reactions = [
    // Reactions for demo-moment-1 (welcome post)
    { userId: 'demo-user-3', momentId: 'demo-moment-1', reactionType: '👍' },
    { userId: 'demo-user-4', momentId: 'demo-moment-1', reactionType: '👍' },
    { userId: 'demo-user-5', momentId: 'demo-moment-1', reactionType: '🔥' },
    { userId: 'demo-user-6', momentId: 'demo-moment-1', reactionType: '🔥' },
    { userId: 'demo-user-7', momentId: 'demo-moment-1', reactionType: '🎉' },

    // Reactions for demo-moment-7 (trade)
    { userId: 'demo-user-3', momentId: 'demo-moment-7', reactionType: '🔥' },
    { userId: 'demo-user-4', momentId: 'demo-moment-7', reactionType: '🔥' },
    { userId: 'demo-user-5', momentId: 'demo-moment-7', reactionType: '👀' },
    { userId: 'demo-user-6', momentId: 'demo-moment-7', reactionType: '👀' },
    { userId: 'demo-user-7', momentId: 'demo-moment-7', reactionType: '😮' },

    // Reactions for rankings
    { userId: 'demo-user-1', momentId: 'demo-moment-12', reactionType: '👍' },
    { userId: 'demo-user-3', momentId: 'demo-moment-12', reactionType: '🤔' },
    { userId: 'demo-user-4', momentId: 'demo-moment-12', reactionType: '👍' },
  ];

  for (const reaction of reactions) {
    await prisma.reaction.upsert({
      where: {
        user_moment_reaction_unique: {
          userId: reaction.userId,
          momentId: reaction.momentId,
          reactionType: reaction.reactionType,
        },
      },
      update: {},
      create: reaction,
    });
    count++;
  }

  console.log(`  ✓ Created ${count} reactions`);
}

async function seedPowerRankings() {
  console.log('📊 Seeding power rankings...');
  let count = 0;

  // Create power rankings for weeks 1-3 in demo league
  for (let week = 1; week <= CURRENT_WEEK; week++) {
    const rankingId = `demo-ranking-week-${week}`;

    await prisma.powerRanking.upsert({
      where: { id: rankingId },
      update: {},
      create: {
        id: rankingId,
        leagueId: 'league-3',
        season: CURRENT_SEASON,
        weekNumber: week,
        status: 'published',
        publishedByUserId: 'demo-user-2',
        publishedAt: new Date(`2026-01-${String(week * 7).padStart(2, '0')}T08:00:00Z`),
      },
    });
    count++;

    // Create entries for each team with rankings based on wins
    const teamRankings = demoLeagueTeams
      .map((team, index) => ({
        teamId: team.id,
        rank: index + 1,
        previousRank: week === 1 ? null : index + (index % 2 === 0 ? 1 : -1) + 1,
        movement:
          week === 1 ? null : (index % 2 === 0 ? -1 : 1) * ((index % 3) + 1),
        commentary:
          week === CURRENT_WEEK
            ? getCommentaryForTeam(team.name, index + 1)
            : null,
      }))
      .sort((a, b) => {
        // Sort by record for realistic rankings
        const teamA = demoLeagueTeams.find((t) => t.id === a.teamId)!;
        const teamB = demoLeagueTeams.find((t) => t.id === b.teamId)!;
        return teamB.wins - teamA.wins || teamA.losses - teamB.losses;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    for (const entry of teamRankings) {
      const entryId = `${rankingId}-${entry.teamId}`;
      await prisma.powerRankingEntry.upsert({
        where: { id: entryId },
        update: {},
        create: {
          id: entryId,
          powerRankingId: rankingId,
          teamId: entry.teamId,
          rank: entry.rank,
          previousRank: entry.previousRank,
          movement: entry.movement,
          commentary: entry.commentary,
        },
      });
    }
  }

  console.log(`  ✓ Created ${count} power rankings with entries`);
}

function getCommentaryForTeam(teamName: string, rank: number): string {
  const commentaries: Record<number, string> = {
    1: `${teamName} continues to dominate! Looking like the team to beat.`,
    2: `${teamName} is right on their heels. Strong performance this week.`,
    3: `Solid showing from ${teamName}. Playoff contender for sure.`,
    4: `${teamName} making moves in the standings. Watch out!`,
    5: `Good week for ${teamName}. Consistency is key.`,
    6: `${teamName} holding steady in the middle of the pack.`,
    7: `${teamName} needs a big win to climb the rankings.`,
    8: `Tough week for ${teamName}. Time to regroup.`,
    9: `${teamName} struggling lately. Need some roster changes?`,
    10: `${teamName} on the outside looking in. Long road ahead.`,
    11: `Rough stretch for ${teamName}. Can they turn it around?`,
    12: `${teamName} at the bottom but any given Sunday...`,
  };
  return commentaries[rank] || `${teamName} ranked #${rank} this week.`;
}

async function seedMatchups() {
  console.log('🏟️ Seeding matchups...');
  let count = 0;

  // Create matchups for demo league (6 matchups per week with 12 teams)
  for (let week = 1; week <= CURRENT_WEEK; week++) {
    const isComplete = week < CURRENT_WEEK;
    const teamPairs: [string, string][] = [
      ['demo-team-1', 'demo-team-12'],
      ['demo-team-2', 'demo-team-11'],
      ['demo-team-3', 'demo-team-10'],
      ['demo-team-4', 'demo-team-9'],
      ['demo-team-5', 'demo-team-8'],
      ['demo-team-6', 'demo-team-7'],
    ];

    for (let i = 0; i < teamPairs.length; i++) {
      const [homeTeamId, awayTeamId] = teamPairs[i]!
      const matchupId = `demo-matchup-week${week}-${i + 1}`;

      // Generate realistic scores
      const homeScore = isComplete ? 100 + Math.random() * 60 : null;
      const awayScore = isComplete ? 100 + Math.random() * 60 : null;
      const winnerId =
        isComplete && homeScore && awayScore
          ? homeScore > awayScore
            ? homeTeamId
            : awayTeamId
          : null;

      await prisma.matchup.upsert({
        where: { id: matchupId },
        update: {},
        create: {
          id: matchupId,
          leagueId: 'league-3',
          season: CURRENT_SEASON,
          weekNumber: week,
          homeTeamId,
          awayTeamId,
          homeTeamScore: homeScore ? parseFloat(homeScore.toFixed(2)) : null,
          awayTeamScore: awayScore ? parseFloat(awayScore.toFixed(2)) : null,
          homeTeamProjected: 115 + Math.random() * 20,
          awayTeamProjected: 115 + Math.random() * 20,
          winnerId,
          isComplete,
          matchupType: 'regular_season',
        },
      });
      count++;

      // Create commissioner prediction for each matchup
      const predictionId = `demo-prediction-${matchupId}`;
      const predictedWinnerId =
        Math.random() > 0.5 ? homeTeamId : awayTeamId;
      const isCorrect = isComplete ? winnerId === predictedWinnerId : null;

      await prisma.matchupPrediction.upsert({
        where: { id: predictionId },
        update: {},
        create: {
          id: predictionId,
          matchupId,
          leagueId: 'league-3',
          season: CURRENT_SEASON,
          weekNumber: week,
          predictedWinnerId,
          hypeText:
            i === 0
              ? 'Matchup of the Week! Top vs Bottom clash.'
              : `Should be a close one between these two rivals.`,
          isFeatured: i === 0,
          status: 'published',
          publishedAt: new Date(`2026-01-${String(week * 7 - 1).padStart(2, '0')}T12:00:00Z`),
          publishedByUserId: 'demo-user-2',
          isCorrect,
          gradedAt: isComplete ? new Date() : null,
        },
      });
    }
  }

  console.log(`  ✓ Created ${count} matchups with predictions`);
}

async function seedPickemEntries() {
  console.log('🎯 Seeding pickem entries...');
  let count = 0;

  // Get all matchups
  const matchups = await prisma.matchup.findMany({
    where: { leagueId: 'league-3' },
    orderBy: [{ weekNumber: 'asc' }, { id: 'asc' }],
  });

  // Create pickem entries for members (first 12 users - managers and admin)
  const pickingUsers = demoUsers.slice(0, 12).map((u) => u.id);

  for (const matchup of matchups) {
    for (const userId of pickingUsers) {
      // Each user picks a winner (slight bias toward home team)
      const predictedWinnerId =
        Math.random() > 0.45 ? matchup.homeTeamId : matchup.awayTeamId;
      const isCorrect = matchup.isComplete
        ? predictedWinnerId === matchup.winnerId
        : null;

      const entryId = `pickem-${matchup.id}-${userId}`;

      await prisma.pickemEntry.upsert({
        where: { id: entryId },
        update: {},
        create: {
          id: entryId,
          userId,
          leagueId: 'league-3',
          matchupId: matchup.id,
          weekNumber: matchup.weekNumber,
          season: CURRENT_SEASON,
          predictedWinnerId,
          lockedAt: matchup.isComplete ? new Date() : null,
          isCorrect,
          pointsEarned: isCorrect ? 1 : 0,
          gradedAt: isCorrect !== null ? new Date() : null,
        },
      });
      count++;
    }
  }

  console.log(`  ✓ Created ${count} pickem entries`);
}

async function seedTransactions() {
  console.log('💱 Seeding transactions...');
  let count = 0;

  const transactions = [
    {
      leagueId: 'league-3',
      weekNumber: 3,
      type: 'waiver' as const,
      teamId: 'demo-team-1',
      playerName: 'Puka Nacua',
      faabAmount: 45,
      timestamp: new Date('2026-01-18T06:00:00Z'),
    },
    {
      leagueId: 'league-3',
      weekNumber: 3,
      type: 'drop' as const,
      teamId: 'demo-team-2',
      playerName: 'Chris Olave',
      timestamp: new Date('2026-01-16T07:30:00Z'),
    },
    {
      leagueId: 'league-3',
      weekNumber: 3,
      type: 'add' as const,
      teamId: 'demo-team-2',
      playerName: 'Romeo Doubs',
      timestamp: new Date('2026-01-16T07:30:00Z'),
    },
    {
      leagueId: 'league-3',
      weekNumber: 2,
      type: 'waiver' as const,
      teamId: 'demo-team-6',
      playerName: "De'Von Achane",
      faabAmount: 67,
      timestamp: new Date('2026-01-14T06:45:00Z'),
    },
    {
      leagueId: 'league-3',
      weekNumber: 2,
      type: 'add' as const,
      teamId: 'demo-team-11',
      playerName: 'Sam LaPorta',
      timestamp: new Date('2026-01-11T08:00:00Z'),
    },
    {
      leagueId: 'league-3',
      weekNumber: 2,
      type: 'drop' as const,
      teamId: 'demo-team-11',
      playerName: 'Cole Kmet',
      timestamp: new Date('2026-01-11T08:00:00Z'),
    },
    {
      leagueId: 'league-3',
      weekNumber: 1,
      type: 'trade' as const,
      teamId: 'demo-team-1',
      playerName: "Ja'Marr Chase",
      tradePartnerTeamId: 'demo-team-2',
      notes: 'Traded for Justin Jefferson and 2026 4th',
      timestamp: new Date('2026-01-17T14:00:00Z'),
    },
    {
      leagueId: 'league-3',
      weekNumber: 1,
      type: 'trade' as const,
      teamId: 'demo-team-7',
      playerName: 'Lamar Jackson',
      tradePartnerTeamId: 'demo-team-8',
      notes: 'Traded for Jalen Hurts and 2026 1st',
      timestamp: new Date('2026-01-10T13:00:00Z'),
    },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: tx,
    });
    count++;
  }

  console.log(`  ✓ Created ${count} transactions`);
}

async function seedSeasonHistory() {
  console.log('📅 Seeding season history...');

  const histories = [
    {
      leagueId: 'league-3',
      year: 2024,
      champion: 'Bayou Bengals',
      runnerUp: 'Metro Mustangs',
      totalMembers: 12,
      championshipScore: '156.8 - 148.2',
      thirdPlace: 'Coastal Condors',
      regularSeasonWinner: 'Bayou Bengals',
      seasonSummary:
        'An exciting season with the Bayou Bengals edging out the Metro Mustangs in a thriller championship matchup.',
    },
    {
      leagueId: 'league-3',
      year: 2023,
      champion: 'Mountain Mavericks',
      runnerUp: 'Lakeside Lions',
      totalMembers: 12,
      championshipScore: '142.5 - 138.2',
      thirdPlace: 'Desert Dragons',
      regularSeasonWinner: 'Metro Mustangs',
      seasonSummary:
        'The Mavericks came from behind in the playoffs to claim the championship!',
    },
    {
      leagueId: 'league-3',
      year: 2022,
      champion: 'Metro Mustangs',
      runnerUp: 'Valley Vikings',
      totalMembers: 12,
      championshipScore: '165.2 - 151.8',
      thirdPlace: 'Bayou Bengals',
      regularSeasonWinner: 'Metro Mustangs',
      seasonSummary:
        'Dominant season for the Mustangs, going wire-to-wire as the top team.',
    },
  ];

  for (const history of histories) {
    await prisma.seasonHistory.upsert({
      where: {
        league_year_history_unique: {
          leagueId: history.leagueId,
          year: history.year,
        },
      },
      update: {},
      create: history,
    });
  }

  console.log(`  ✓ Created ${histories.length} season history records`);
}

async function seedEngagementMetrics() {
  console.log('📈 Seeding engagement metrics...');

  for (let week = 1; week <= CURRENT_WEEK; week++) {
    await prisma.engagementMetrics.upsert({
      where: {
        league_week_engagement_unique: {
          leagueId: 'league-3',
          weekNumber: week,
        },
      },
      update: {},
      create: {
        leagueId: 'league-3',
        weekNumber: week,
        momentsCreated: 5 + Math.floor(Math.random() * 10),
        commentsCount: 15 + Math.floor(Math.random() * 25),
        reactionsCount: 30 + Math.floor(Math.random() * 50),
        uniqueActiveUsers: 10 + Math.floor(Math.random() * 6),
        peakDailyActivity: 20 + Math.floor(Math.random() * 30),
      },
    });
  }

  console.log(`  ✓ Created ${CURRENT_WEEK} engagement metrics records`);
}

async function seedStats() {
  console.log('📊 Seeding stats tables...');

  // Get graded pickem entries to calculate stats
  const pickemEntries = await prisma.pickemEntry.findMany({
    where: {
      leagueId: 'league-3',
      isCorrect: { not: null },
    },
  });

  // Group by user and week
  const weeklyStatsMap = new Map<string, Map<number, { correct: number; total: number }>>();
  const seasonStatsMap = new Map<string, { correct: number; total: number }>();

  for (const entry of pickemEntries) {
    const userId = entry.userId;
    const week = entry.weekNumber;

    // Weekly
    if (!weeklyStatsMap.has(userId)) {
      weeklyStatsMap.set(userId, new Map());
    }
    const userWeekly = weeklyStatsMap.get(userId)!;
    if (!userWeekly.has(week)) {
      userWeekly.set(week, { correct: 0, total: 0 });
    }
    const weekStats = userWeekly.get(week)!;
    weekStats.total++;
    if (entry.isCorrect) weekStats.correct++;

    // Season
    if (!seasonStatsMap.has(userId)) {
      seasonStatsMap.set(userId, { correct: 0, total: 0 });
    }
    const userSeason = seasonStatsMap.get(userId)!;
    userSeason.total++;
    if (entry.isCorrect) userSeason.correct++;
  }

  // Create weekly stats
  for (const [userId, weeks] of weeklyStatsMap) {
    for (const [weekNumber, stats] of weeks) {
      await prisma.weeklyStats.upsert({
        where: {
          user_league_week_stats_unique: {
            userId,
            leagueId: 'league-3',
            season: CURRENT_SEASON,
            weekNumber,
          },
        },
        update: {
          totalPicks: stats.total,
          correctPicks: stats.correct,
          accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        },
        create: {
          userId,
          leagueId: 'league-3',
          season: CURRENT_SEASON,
          weekNumber,
          totalPicks: stats.total,
          correctPicks: stats.correct,
          accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        },
      });
    }
  }

  // Create season stats
  for (const [userId, stats] of seasonStatsMap) {
    const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;

    await prisma.seasonStats.upsert({
      where: {
        user_league_season_stats_unique: {
          userId,
          leagueId: 'league-3',
          season: CURRENT_SEASON,
        },
      },
      update: {
        totalPicks: stats.total,
        correctPicks: stats.correct,
        accuracy,
      },
      create: {
        userId,
        leagueId: 'league-3',
        season: CURRENT_SEASON,
        totalPicks: stats.total,
        correctPicks: stats.correct,
        accuracy,
        currentStreak: Math.floor(Math.random() * 5),
        longestStreak: 3 + Math.floor(Math.random() * 5),
        perfectWeeks: accuracy >= 100 ? 1 : 0,
        bestWeekAccuracy: accuracy > 0 ? Math.min(100, accuracy + Math.random() * 20) : null,
      },
    });

    // Create all-time stats
    await prisma.allTimeStats.upsert({
      where: {
        user_league_alltime_stats_unique: {
          userId,
          leagueId: 'league-3',
        },
      },
      update: {
        totalPicks: stats.total,
        correctPicks: stats.correct,
        accuracy,
      },
      create: {
        userId,
        leagueId: 'league-3',
        totalPicks: stats.total,
        correctPicks: stats.correct,
        accuracy,
        longestStreak: 5 + Math.floor(Math.random() * 10),
        seasonsPlayed: 3,
        bestSeasonAccuracy: 70 + Math.random() * 20,
        perfectWeeksTotal: Math.floor(Math.random() * 5),
        championshipWins: Math.random() > 0.8 ? 1 : 0,
      },
    });
  }

  console.log(`  ✓ Created stats for ${seasonStatsMap.size} users`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Cleanup existing seed data first
    await cleanupDatabase();

    // Seed in order respecting foreign key constraints
    await seedUsers();
    await seedLeagues();
    await seedTeams();
    await seedLeagueMemberships();
    await seedLeagueSettings();
    await seedMoments();
    await seedComments();
    await seedReactions();
    await seedPowerRankings();
    await seedMatchups();
    await seedPickemEntries();
    await seedTransactions();
    await seedSeasonHistory();
    await seedEngagementMetrics();
    await seedStats();

    console.log('\n✅ Database seeding complete!');
    console.log('\n📋 Summary:');
    console.log(`   - ${allUsers.length} users`);
    console.log(`   - ${leagues.length} leagues`);
    console.log(`   - ${allTeams.length} teams`);
    console.log(`   - Demo league with full data for testing`);
    console.log(`   - Matchups and pickems for weeks 1-${CURRENT_WEEK}`);
    console.log('\n🔑 Test Credentials:');
    console.log('   Email: test@samus.ai | Password: 12345');
    console.log('   Email: donny@samus.ai | Password: 12345');
    console.log('   Email: john@example.com | Password: 12345 (demo admin)');
    console.log('   Email: jane@example.com | Password: 12345 (demo commissioner)');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
