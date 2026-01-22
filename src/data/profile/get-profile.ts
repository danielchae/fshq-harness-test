import { unstable_cache } from 'next/cache';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import type { Prisma } from '@prisma/client';

import type {
  NotificationPreferences,
  NotificationPreferencesUpdateInput,
  ProfileUpdateInput,
  UserProfile,
  UserProfileData,
  UserStats,
} from '@/types/profile';

/**
 * Default notification preferences for new users
 */
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pickReminders: true,
  leagueUpdates: true,
};

/**
 * Default stats for users with no pick history
 */
const DEFAULT_USER_STATS: UserStats = {
  seasonRecord: {
    wins: 0,
    losses: 0,
    ties: 0,
    percentage: 0,
  },
  allTimeRecord: {
    wins: 0,
    losses: 0,
    ties: 0,
    percentage: 0,
    seasons: 0,
  },
};

/**
 * Internal function to fetch user profile from database
 */
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      image: true,
      preferences: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return null;
  }

  // Extract bio from preferences JSON if it exists
  const preferences = user.preferences as Record<string, unknown> | null;
  const bio = preferences?.bio as string | undefined;

  return {
    id: user.id,
    name: user.name || '',
    email: user.email,
    avatarUrl: user.avatarUrl || user.image || '',
    bio,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Internal function to aggregate user stats across all leagues
 */
async function fetchUserStats(userId: string): Promise<UserStats> {
  // Fetch current season stats across all leagues
  const currentYear = new Date().getFullYear();

  const [seasonStats, allTimeStats] = await Promise.all([
    // Get current season stats aggregated across all leagues
    prisma.seasonStats.findMany({
      where: {
        userId,
        season: currentYear,
      },
      select: {
        totalPicks: true,
        correctPicks: true,
      },
    }),
    // Get all-time stats aggregated across all leagues
    prisma.allTimeStats.findMany({
      where: { userId },
      select: {
        totalPicks: true,
        correctPicks: true,
        seasonsPlayed: true,
      },
    }),
  ]);

  // Aggregate season record
  const seasonTotalPicks = seasonStats.reduce((sum, s) => sum + s.totalPicks, 0);
  const seasonCorrectPicks = seasonStats.reduce((sum, s) => sum + s.correctPicks, 0);
  const seasonIncorrectPicks = seasonTotalPicks - seasonCorrectPicks;

  // Aggregate all-time record
  const allTimeTotalPicks = allTimeStats.reduce((sum, s) => sum + s.totalPicks, 0);
  const allTimeCorrectPicks = allTimeStats.reduce((sum, s) => sum + s.correctPicks, 0);
  const allTimeIncorrectPicks = allTimeTotalPicks - allTimeCorrectPicks;
  // Count unique seasons played (max across leagues since user participates in multiple leagues per season)
  const maxSeasonsPlayed = allTimeStats.length > 0
    ? Math.max(...allTimeStats.map(s => s.seasonsPlayed))
    : 0;

  return {
    seasonRecord: {
      wins: seasonCorrectPicks,
      losses: seasonIncorrectPicks,
      ties: 0, // Pick'ems don't have ties
      percentage: seasonTotalPicks > 0
        ? Math.round((seasonCorrectPicks / seasonTotalPicks) * 1000) / 1000
        : 0,
    },
    allTimeRecord: {
      wins: allTimeCorrectPicks,
      losses: allTimeIncorrectPicks,
      ties: 0, // Pick'ems don't have ties
      percentage: allTimeTotalPicks > 0
        ? Math.round((allTimeCorrectPicks / allTimeTotalPicks) * 1000) / 1000
        : 0,
      seasons: maxSeasonsPlayed,
    },
  };
}

/**
 * Internal function to fetch notification preferences from user preferences JSON
 */
async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user || !user.preferences) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const prefs = user.preferences as Record<string, unknown>;
  const notifications = prefs.notifications as Record<string, boolean> | undefined;

  if (!notifications) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return {
    pickReminders: notifications.pickReminders ?? DEFAULT_NOTIFICATION_PREFERENCES.pickReminders,
    leagueUpdates: notifications.leagueUpdates ?? DEFAULT_NOTIFICATION_PREFERENCES.leagueUpdates,
  };
}

/**
 * Cached user profile fetcher
 * Uses unstable_cache with tag: profile-{userId}
 */
const getCachedUserProfile = (userId: string) =>
  unstable_cache(
    async () => fetchUserProfile(userId),
    [`profile-${userId}`],
    {
      tags: [`profile-${userId}`],
      revalidate: 300, // Cache for 5 minutes
    }
  );

/**
 * Cached user stats fetcher
 * Uses unstable_cache with tag: profile-stats-{userId}
 */
const getCachedUserStats = (userId: string) =>
  unstable_cache(
    async () => fetchUserStats(userId),
    [`profile-stats-${userId}`],
    {
      tags: [`profile-${userId}`, `profile-stats-${userId}`],
      revalidate: 300, // Cache for 5 minutes
    }
  );

/**
 * Cached notification preferences fetcher
 * Uses unstable_cache with tag: profile-{userId}
 */
const getCachedNotificationPreferences = (userId: string) =>
  unstable_cache(
    async () => fetchNotificationPreferences(userId),
    [`profile-notifications-${userId}`],
    {
      tags: [`profile-${userId}`],
      revalidate: 300, // Cache for 5 minutes
    }
  );

/**
 * Get user profile data for the current authenticated user
 * Queries user profile with notification preferences and aggregated pick'ems stats
 * Cached per user session
 */
export async function getUserProfile(userId?: string): Promise<UserProfileData | null> {
  // Get userId from session if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const session = await auth();
    resolvedUserId = session?.user?.id;
  }

  if (!resolvedUserId) {
    return null;
  }

  // Fetch all profile components in parallel
  const [profile, stats, notificationPreferences] = await Promise.all([
    getCachedUserProfile(resolvedUserId)(),
    getCachedUserStats(resolvedUserId)(),
    getCachedNotificationPreferences(resolvedUserId)(),
  ]);

  if (!profile) {
    return null;
  }

  return {
    profile,
    stats,
    notificationPreferences,
  };
}

/**
 * Get user stats for the current authenticated user
 * Aggregates pick'ems stats across all leagues
 */
export async function getUserStats(userId?: string): Promise<UserStats> {
  // Get userId from session if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const session = await auth();
    resolvedUserId = session?.user?.id;
  }

  if (!resolvedUserId) {
    return DEFAULT_USER_STATS;
  }

  return getCachedUserStats(resolvedUserId)();
}

/**
 * Get notification preferences for the current authenticated user
 */
export async function getNotificationPreferences(userId?: string): Promise<NotificationPreferences> {
  // Get userId from session if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const session = await auth();
    resolvedUserId = session?.user?.id;
  }

  if (!resolvedUserId) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return getCachedNotificationPreferences(resolvedUserId)();
}

/**
 * Update user profile
 * Updates name and bio fields and revalidates cache
 */
export async function updateUserProfile(input: ProfileUpdateInput, userId?: string): Promise<UserProfile | null> {
  // Get userId from session if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const session = await auth();
    resolvedUserId = session?.user?.id;
  }

  if (!resolvedUserId) {
    return null;
  }

  // Build update data with proper Prisma typing
  const updateData: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  // Handle bio update through preferences JSON
  if (input.bio !== undefined) {
    const currentUser = await prisma.user.findUnique({
      where: { id: resolvedUserId },
      select: { preferences: true },
    });

    const currentPrefs = (currentUser?.preferences as Record<string, unknown>) || {};
    updateData.preferences = {
      ...currentPrefs,
      bio: input.bio,
    } as Prisma.InputJsonValue;
  }

  const updatedUser = await prisma.user.update({
    where: { id: resolvedUserId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      image: true,
      preferences: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Cache will be automatically invalidated via unstable_cache's revalidate setting
  // For immediate revalidation, a server action should use revalidatePath

  const preferences = updatedUser.preferences as Record<string, unknown> | null;
  const bio = preferences?.bio as string | undefined;

  return {
    id: updatedUser.id,
    name: updatedUser.name || '',
    email: updatedUser.email,
    avatarUrl: updatedUser.avatarUrl || updatedUser.image || '',
    bio,
    createdAt: updatedUser.createdAt.toISOString(),
    updatedAt: updatedUser.updatedAt.toISOString(),
  };
}

/**
 * Update notification preferences
 * Stores preferences in user.preferences JSON and revalidates cache
 */
export async function updateNotificationPreferences(
  input: NotificationPreferencesUpdateInput,
  userId?: string
): Promise<NotificationPreferences> {
  // Get userId from session if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const session = await auth();
    resolvedUserId = session?.user?.id;
  }

  if (!resolvedUserId) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  // Get current preferences
  const currentUser = await prisma.user.findUnique({
    where: { id: resolvedUserId },
    select: { preferences: true },
  });

  const currentPrefs = (currentUser?.preferences as Record<string, unknown>) || {};
  const currentNotifications = (currentPrefs.notifications as Record<string, boolean>) || {};

  // Merge new notification preferences
  const updatedNotifications = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...currentNotifications,
    ...input,
  };

  // Update user preferences
  await prisma.user.update({
    where: { id: resolvedUserId },
    data: {
      preferences: {
        ...currentPrefs,
        notifications: updatedNotifications,
      } as Prisma.InputJsonValue,
    },
  });

  // Cache will be automatically invalidated via unstable_cache's revalidate setting
  // For immediate revalidation, a server action should use revalidatePath

  return updatedNotifications;
}
