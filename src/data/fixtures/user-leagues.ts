import type { UserLeague } from '@/types/user-league';

// Mock user leagues for development
export const mockUserLeagues: UserLeague[] = [
  {
    id: '1',
    slug: 'demo-league',
    name: 'Demo League',
    logoUrl: 'https://picsum.photos/seed/demo-league/200/200',
  },
  {
    id: '2',
    slug: 'test-league',
    name: 'Test League',
    logoUrl: 'https://picsum.photos/seed/test-league/200/200',
  },
];
