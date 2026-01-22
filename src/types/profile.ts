// User profile types

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

export interface ProfileUpdateInput {
  name?: string;
  bio?: string;
}

export interface NotificationPreferencesUpdateInput {
  pickReminders?: boolean;
  leagueUpdates?: boolean;
}
