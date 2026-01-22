// Profile type definitions and seed data for development/testing
// NOTE: Real implementation uses Prisma in src/data/profile/. These types are
// exported for use across the codebase; mock data provides fallback/seeding.

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  seasonRecord: {
    wins: number;
    losses: number;
    ties: number;
    percentage: number;
  };
  allTimeRecord: {
    wins: number;
    losses: number;
    ties: number;
    percentage: number;
    seasons: number;
  };
}

export interface NotificationPreferences {
  pickReminders: boolean;
  leagueUpdates: boolean;
}

export interface UserProfileData {
  profile: UserProfile;
  stats: UserStats;
  notificationPreferences: NotificationPreferences;
}

export const MOCK_USER_PROFILE: UserProfile = {
  id: 'user-1',
  name: 'John Smith',
  email: 'john@example.com',
  avatarUrl: 'https://picsum.photos/seed/john/200/200',
  bio: 'Fantasy sports enthusiast since 2015',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2026-01-18T08:30:00Z',
};

export const MOCK_USER_STATS: UserStats = {
  seasonRecord: {
    wins: 45,
    losses: 23,
    ties: 2,
    percentage: 0.657,
  },
  allTimeRecord: {
    wins: 312,
    losses: 198,
    ties: 15,
    percentage: 0.609,
    seasons: 4,
  },
};

export const MOCK_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pickReminders: true,
  leagueUpdates: true,
};

export const MOCK_PROFILE_DATA: UserProfileData = {
  profile: MOCK_USER_PROFILE,
  stats: MOCK_USER_STATS,
  notificationPreferences: MOCK_NOTIFICATION_PREFERENCES,
};
