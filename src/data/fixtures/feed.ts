// Feed/Moments seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/feed/. Types are defined
// in src/types/feed.ts; this file provides fallback/seed data for testing.

import type { Comment, Moment, MomentDetail } from '@/types/feed';

// Legacy moments for backward compatibility
export const mockMoments: Moment[] = [
  {
    id: 'moment-1',
    type: 'post',
    content: 'Just made a huge trade! What do you all think?',
    createdAt: '2024-01-15T18:30:00Z',
    authorId: 'user-1',
    authorName: 'TestUser',
    authorAvatar: 'https://picsum.photos/seed/user1/50/50',
    reactions: { '👍': 8, '🔥': 3, '😂': 2 },
    commentCount: 5,
  },
  {
    id: 'moment-2',
    type: 'trade',
    content: 'Trade completed',
    createdAt: '2024-01-15T16:00:00Z',
    tradeDetails: {
      team1: 'Dynasty Dragons',
      team2: 'Touchdown Titans',
      players1: ['Patrick Mahomes', '2025 1st'],
      players2: ['Josh Allen', 'Garrett Wilson'],
    },
    reactions: { '🔥': 12, '👀': 8 },
    commentCount: 15,
  },
  {
    id: 'moment-3',
    type: 'rankings',
    content: 'Week 15 Power Rankings are out! Check out who moved up and who tumbled.',
    createdAt: '2024-01-14T12:00:00Z',
    authorId: 'user-1',
    authorName: 'Commissioner',
    authorAvatar: 'https://picsum.photos/seed/commissioner/50/50',
    reactions: { '👍': 5, '🤔': 3 },
    commentCount: 8,
  },
  {
    id: 'moment-4',
    type: 'matchResult',
    content: 'Dynasty Dragons defeats Touchdown Titans 142.5 - 138.2 in a thriller!',
    createdAt: '2024-01-13T23:59:00Z',
    reactions: { '🎉': 4, '😢': 2 },
    commentCount: 3,
  },
  {
    id: 'moment-5',
    type: 'post',
    content: "Can't believe the trade deadline is tomorrow. Last chance to make moves!",
    createdAt: '2024-01-12T20:00:00Z',
    authorId: 'user-3',
    authorName: 'Manager1',
    authorAvatar: 'https://picsum.photos/seed/user3/50/50',
    reactions: { '👍': 2 },
    commentCount: 1,
  },
  {
    id: 'moment-6',
    type: 'trade',
    content: 'Trade completed',
    createdAt: '2024-01-11T14:30:00Z',
    tradeDetails: {
      team1: 'Gridiron Giants',
      team2: 'Fantasy Phenoms',
      players1: ['CeeDee Lamb'],
      players2: ['Amon-Ra St. Brown', '2025 2nd'],
    },
    reactions: { '👍': 6, '🔥': 4 },
    commentCount: 7,
  },
  {
    id: 'moment-7',
    type: 'prediction',
    content: 'My picks for Week 16: Dragons over Titans, Giants upset Phenoms',
    createdAt: '2024-01-10T10:00:00Z',
    authorId: 'user-1',
    authorName: 'Commissioner',
    authorAvatar: 'https://picsum.photos/seed/commissioner/50/50',
    reactions: { '🤔': 5, '👍': 3 },
    commentCount: 4,
  },
  {
    id: 'moment-8',
    type: 'transaction',
    content: 'Dynasty Dragons adds Puka Nacua from waivers',
    createdAt: '2024-01-09T08:00:00Z',
    reactions: { '🔥': 3 },
    commentCount: 2,
  },
];

// Demo league moments - 20+ moments with various types
// E2E test expects types: 'post', 'trade', 'rankings', 'transaction', 'pickems'
export const demoLeagueMoments: Moment[] = [
  // Posts (6)
  {
    id: 'demo-moment-1',
    type: 'post',
    content: 'Welcome to the new season everyone! Excited to see how this year plays out.',
    createdAt: '2026-01-18T10:00:00Z',
    authorId: 'demo-user-2',
    authorName: 'Jane Doe',
    authorAvatar: 'https://picsum.photos/seed/jane/50/50',
    reactions: { '👍': 15, '🔥': 8, '🎉': 5 },
    commentCount: 12,
  },
  {
    id: 'demo-moment-2',
    type: 'post',
    content: 'That game last night was insane! My team barely pulled through.',
    createdAt: '2026-01-17T22:30:00Z',
    authorId: 'demo-user-3',
    authorName: 'Bob Johnson',
    authorAvatar: 'https://picsum.photos/seed/bob/50/50',
    reactions: { '👍': 6, '😂': 3 },
    commentCount: 4,
  },
  {
    id: 'demo-moment-3',
    type: 'post',
    content: 'Looking to make some moves before the deadline. Who wants to trade?',
    createdAt: '2026-01-16T15:00:00Z',
    authorId: 'demo-user-5',
    authorName: 'Charlie Brown',
    authorAvatar: 'https://picsum.photos/seed/charlie/50/50',
    reactions: { '👀': 8, '🤔': 4 },
    commentCount: 7,
  },
  {
    id: 'demo-moment-4',
    type: 'post',
    content: 'Just hit 1000 points scored this season! New personal record!',
    createdAt: '2026-01-15T18:45:00Z',
    authorId: 'demo-user-4',
    authorName: 'Alice Williams',
    authorAvatar: 'https://picsum.photos/seed/alice/50/50',
    reactions: { '🎉': 12, '🔥': 9, '👍': 5 },
    commentCount: 8,
  },
  {
    id: 'demo-moment-5',
    type: 'post',
    content: 'My team finally got a winning streak going. Three in a row!',
    createdAt: '2026-01-14T20:00:00Z',
    authorId: 'demo-user-7',
    authorName: 'Eve Miller',
    authorAvatar: 'https://picsum.photos/seed/eve/50/50',
    reactions: { '👍': 4, '💪': 3 },
    commentCount: 2,
  },
  {
    id: 'demo-moment-6',
    type: 'post',
    content: 'Commissioner prediction was spot on this week. Impressive!',
    createdAt: '2026-01-13T09:30:00Z',
    authorId: 'demo-user-13',
    authorName: 'Kelly Martinez',
    authorAvatar: 'https://picsum.photos/seed/kelly/50/50',
    reactions: { '👍': 7, '🎯': 5 },
    commentCount: 3,
  },

  // Trades (5)
  {
    id: 'demo-moment-7',
    type: 'trade',
    content: 'Trade completed',
    createdAt: '2026-01-17T14:00:00Z',
    tradeDetails: {
      team1: 'Bayou Bengals',
      team2: 'Metro Mustangs',
      players1: ["Ja'Marr Chase", '2026 2nd'],
      players2: ['Justin Jefferson', '2026 4th'],
    },
    reactions: { '🔥': 18, '👀': 12, '😮': 6 },
    commentCount: 22,
  },
  {
    id: 'demo-moment-8',
    type: 'trade',
    content: 'Trade completed',
    createdAt: '2026-01-15T11:30:00Z',
    tradeDetails: {
      team1: 'Coastal Condors',
      team2: 'Mountain Mavericks',
      players1: ['Bijan Robinson'],
      players2: ['Breece Hall', '2026 3rd'],
    },
    reactions: { '👍': 9, '🔥': 7 },
    commentCount: 11,
  },
  {
    id: 'demo-moment-9',
    type: 'trade',
    content: 'Trade completed',
    createdAt: '2026-01-12T16:45:00Z',
    tradeDetails: {
      team1: 'Lakeside Lions',
      team2: 'Desert Dragons',
      players1: ['Travis Kelce', '2027 1st'],
      players2: ['Mark Andrews', 'DeVonta Smith'],
    },
    reactions: { '🤔': 15, '👀': 10 },
    commentCount: 18,
  },
  {
    id: 'demo-moment-10',
    type: 'trade',
    content: 'Trade completed',
    createdAt: '2026-01-10T13:00:00Z',
    tradeDetails: {
      team1: 'Valley Vikings',
      team2: 'Harbor Hawks',
      players1: ['Lamar Jackson'],
      players2: ['Jalen Hurts', '2026 1st'],
    },
    reactions: { '🔥': 22, '😱': 8 },
    commentCount: 25,
  },
  {
    id: 'demo-moment-11',
    type: 'trade',
    content: 'Trade completed',
    createdAt: '2026-01-08T09:15:00Z',
    tradeDetails: {
      team1: 'Prairie Panthers',
      team2: 'River Raptors',
      players1: ['Tyreek Hill'],
      players2: ['DK Metcalf', 'Jaylen Waddle'],
    },
    reactions: { '👍': 11, '🔥': 6 },
    commentCount: 9,
  },

  // Rankings (3)
  {
    id: 'demo-moment-12',
    type: 'rankings',
    content: 'Week 3 Power Rankings are live! Big shakeup this week.',
    createdAt: '2026-01-17T08:00:00Z',
    authorId: 'demo-user-2',
    authorName: 'Jane Doe',
    authorAvatar: 'https://picsum.photos/seed/jane/50/50',
    reactions: { '👍': 14, '🤔': 6, '👀': 8 },
    commentCount: 16,
  },
  {
    id: 'demo-moment-13',
    type: 'rankings',
    content: 'Week 2 Power Rankings published. Some surprising moves!',
    createdAt: '2026-01-10T08:00:00Z',
    authorId: 'demo-user-2',
    authorName: 'Jane Doe',
    authorAvatar: 'https://picsum.photos/seed/jane/50/50',
    reactions: { '👍': 10, '🤔': 4 },
    commentCount: 11,
  },
  {
    id: 'demo-moment-14',
    type: 'rankings',
    content: 'Week 1 Power Rankings are here! Season opener analysis.',
    createdAt: '2026-01-03T08:00:00Z',
    authorId: 'demo-user-2',
    authorName: 'Jane Doe',
    authorAvatar: 'https://picsum.photos/seed/jane/50/50',
    reactions: { '👍': 8, '🔥': 5 },
    commentCount: 9,
  },

  // Transactions (4)
  {
    id: 'demo-moment-15',
    type: 'transaction',
    content: 'Bayou Bengals adds Puka Nacua from waivers',
    createdAt: '2026-01-18T06:00:00Z',
    reactions: { '🔥': 8, '👀': 4 },
    commentCount: 5,
  },
  {
    id: 'demo-moment-16',
    type: 'transaction',
    content: 'Metro Mustangs drops Chris Olave, adds Romeo Doubs',
    createdAt: '2026-01-16T07:30:00Z',
    reactions: { '🤔': 6, '👍': 3 },
    commentCount: 4,
  },
  {
    id: 'demo-moment-17',
    type: 'transaction',
    content: "Desert Dragons claims De'Von Achane off waivers",
    createdAt: '2026-01-14T06:45:00Z',
    reactions: { '🔥': 12, '💪': 7 },
    commentCount: 8,
  },
  {
    id: 'demo-moment-18',
    type: 'transaction',
    content: 'Summit Sharks adds Sam LaPorta, drops Cole Kmet',
    createdAt: '2026-01-11T08:00:00Z',
    reactions: { '👍': 5 },
    commentCount: 2,
  },

  // Pick'ems (4)
  {
    id: 'demo-moment-19',
    type: 'pickems',
    content: "Week 3 Pick'ems results are in! John Smith leads with 10-2 record.",
    createdAt: '2026-01-17T23:00:00Z',
    reactions: { '🎉': 6, '👍': 9 },
    commentCount: 7,
  },
  {
    id: 'demo-moment-20',
    type: 'pickems',
    content: "Week 2 Pick'ems wrapped up. Close competition this week!",
    createdAt: '2026-01-10T23:00:00Z',
    reactions: { '👍': 7, '🤔': 3 },
    commentCount: 5,
  },
  {
    id: 'demo-moment-21',
    type: 'pickems',
    content: "Week 1 Pick'ems are locked in. Good luck everyone!",
    createdAt: '2026-01-03T12:00:00Z',
    reactions: { '🍀': 8, '👍': 5 },
    commentCount: 4,
  },
  {
    id: 'demo-moment-22',
    type: 'pickems',
    content: "Season Pick'ems standings updated. Check the leaderboard!",
    createdAt: '2026-01-18T00:00:00Z',
    reactions: { '📊': 6, '👀': 4 },
    commentCount: 3,
  },
];

// Comments seed data for moment detail pages
// NOTE: Real implementation uses Prisma in src/data/comments/.
export const mockComments: Record<string, Comment[]> = {
  'moment-1': [
    {
      id: 'comment-1',
      content: 'Great trade! You got the better end of this deal for sure.',
      author: 'Manager2',
      authorAvatar: 'https://picsum.photos/seed/manager2/50/50',
      authorRole: 'Manager',
      createdAt: '2024-01-15T19:00:00Z',
      isOwner: false,
    },
    {
      id: 'comment-2',
      content: 'I disagree, I think the other team won this trade long-term.',
      author: 'Manager3',
      authorAvatar: 'https://picsum.photos/seed/manager3/50/50',
      authorRole: 'Manager',
      createdAt: '2024-01-15T19:30:00Z',
      isOwner: false,
    },
    {
      id: 'comment-3',
      content: 'Fair point! Time will tell.',
      author: 'Manager2',
      authorAvatar: 'https://picsum.photos/seed/manager2/50/50',
      authorRole: 'Manager',
      createdAt: '2024-01-15T20:00:00Z',
      parentId: 'comment-2',
      isOwner: false,
    },
    {
      id: 'comment-4',
      content: "I'm excited about this trade!",
      author: 'TestUser',
      authorAvatar: 'https://picsum.photos/seed/user1/50/50',
      authorRole: 'Manager',
      createdAt: '2024-01-15T20:30:00Z',
      isOwner: true,
    },
    {
      id: 'comment-5',
      content: 'Good luck with your season!',
      author: 'Fan1',
      authorAvatar: 'https://picsum.photos/seed/fan1/50/50',
      authorRole: 'Fan',
      createdAt: '2024-01-15T21:00:00Z',
      isOwner: false,
    },
  ],
  'moment-2': [
    {
      id: 'comment-6',
      content: 'Blockbuster trade! Both teams are taking a risk here.',
      author: 'Commissioner',
      authorAvatar: 'https://picsum.photos/seed/commissioner/50/50',
      authorRole: 'Commissioner',
      createdAt: '2024-01-15T16:30:00Z',
      isOwner: false,
    },
  ],
  'valid-moment': [
    {
      id: '1',
      content: 'First comment',
      author: 'User A',
      createdAt: '2024-01-15T10:00:00Z',
      isOwner: false,
    },
    {
      id: '2',
      content: 'Second comment',
      author: 'User B',
      createdAt: '2024-01-15T10:30:00Z',
      parentId: '1',
      isOwner: false,
    },
  ],
};

// Helper function to get moment detail with comments
export function getMockMomentDetail(momentId: string): MomentDetail | null {
  // Handle test moment ID
  if (momentId === 'valid-moment') {
    return {
      id: 'valid-moment',
      type: 'post',
      content: 'Test moment content',
      createdAt: '2024-01-15T10:00:00Z',
      authorName: 'Test Author',
      authorAvatar: 'https://picsum.photos/seed/testauthor/50/50',
      reactions: { '👍': 5, '🔥': 2 },
      commentCount: 2,
      comments: mockComments['valid-moment'] || [],
    };
  }

  const moment = mockMoments.find((m) => m.id === momentId);
  if (!moment) return null;

  return {
    ...moment,
    comments: mockComments[momentId] || [],
  };
}
