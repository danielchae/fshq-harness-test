// Moderation seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/moderation/. Types are defined
// in src/types/moderation.ts; this file provides fallback/seed data for testing.

import type { HiddenMoment } from '@/types/moderation';

export const mockHiddenMoments: HiddenMoment[] = [
  {
    id: 'hidden-1',
    content: 'This post contained spam links and promotional content.',
    hideReason: 'Spam',
    hiddenAt: '2024-01-15T10:00:00Z',
    hiddenBy: 'admin-user',
    authorId: 'user-5',
    authorName: 'SpamUser',
    authorAvatar: 'https://picsum.photos/seed/spamuser/50/50',
    type: 'post',
    originalCreatedAt: '2024-01-14T08:30:00Z',
  },
  {
    id: 'hidden-2',
    content: 'Inappropriate language and personal attacks on other managers.',
    hideReason: 'Harassment',
    hiddenAt: '2024-01-14T15:30:00Z',
    hiddenBy: 'mod-user',
    authorId: 'user-8',
    authorName: 'ToxicManager',
    authorAvatar: 'https://picsum.photos/seed/toxicuser/50/50',
    type: 'comment',
    originalCreatedAt: '2024-01-14T14:00:00Z',
  },
  {
    id: 'hidden-3',
    content: 'Trade discussion with misleading player injury information.',
    hideReason: 'Misinformation',
    hiddenAt: '2024-01-13T09:00:00Z',
    hiddenBy: 'admin-user',
    authorId: 'user-3',
    authorName: 'Manager3',
    authorAvatar: 'https://picsum.photos/seed/user3/50/50',
    type: 'post',
    originalCreatedAt: '2024-01-12T20:00:00Z',
  },
  {
    id: 'hidden-4',
    content: 'Off-topic political discussion that violated community guidelines.',
    hideReason: 'Off-topic',
    hiddenAt: '2024-01-12T18:45:00Z',
    hiddenBy: 'mod-user',
    authorId: 'user-10',
    authorName: 'DebateKing',
    authorAvatar: 'https://picsum.photos/seed/debate/50/50',
    type: 'post',
    originalCreatedAt: '2024-01-12T16:00:00Z',
  },
];
