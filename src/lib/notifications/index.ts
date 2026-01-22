/**
 * Notification Service
 *
 * Handles in-app notifications, email notifications via Resend, and prepares
 * for push notifications.
 *
 * In-app notifications are stored in the user's preferences JSON field.
 * Email notifications are sent via Resend.
 * Push notifications are ready for integration with OneSignal/FCM.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  isEmailEnabled,
  sendCommentReplyEmail,
  sendMatchupResultEmail,
  sendMembershipApprovedEmail,
  sendPickReminderEmail,
  sendPowerRankingsPublishedEmail,
  sendStatCorrectionEmail,
  sendTeamClaimedEmail,
} from '@/lib/email';

// Notification types
export type NotificationType =
  | 'stat_correction'
  | 'pick_reminder'
  | 'league_update'
  | 'comment_reply'
  | 'moment_reaction'
  | 'membership_approved'
  | 'team_claimed'
  | 'power_rankings_published'
  | 'matchup_result';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  leagueId?: string;
  leagueSlug?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  pickReminders: boolean;
  leagueUpdates: boolean;
  weeklyDigest: boolean;
}

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  leagueId?: string;
  leagueSlug?: string;
  link?: string;
}

export interface SendBulkNotificationInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  leagueId?: string;
  leagueSlug?: string;
  link?: string;
}

/**
 * Get user's notification preferences
 * Aligned with the profile notification preferences stored in user.preferences.notifications
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  // Notification preferences are stored under the 'notifications' key in preferences
  const notifPrefs = (prefs.notifications as Record<string, boolean>) ?? {};

  return {
    emailNotifications: notifPrefs.emailNotifications ?? true,
    pushNotifications: notifPrefs.pushNotifications ?? false,
    pickReminders: notifPrefs.pickReminders ?? true,
    leagueUpdates: notifPrefs.leagueUpdates ?? true,
    weeklyDigest: notifPrefs.weeklyDigest ?? false,
  };
}

/**
 * Check if user wants to receive a specific type of notification
 */
function shouldSendNotification(
  prefs: NotificationPreferences,
  type: NotificationType
): { email: boolean; push: boolean; inApp: boolean } {
  // Always send in-app notifications
  const inApp = true;

  // Check if email/push are enabled globally
  const email = prefs.emailNotifications;
  const push = prefs.pushNotifications;

  // Check type-specific preferences
  switch (type) {
    case 'pick_reminder':
      return { inApp, email: email && prefs.pickReminders, push: push && prefs.pickReminders };
    case 'league_update':
    case 'power_rankings_published':
    case 'membership_approved':
      return { inApp, email: email && prefs.leagueUpdates, push: push && prefs.leagueUpdates };
    default:
      return { inApp, email, push };
  }
}

/**
 * Get user's in-app notifications
 */
export async function getNotifications(userId: string): Promise<Notification[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  const notificationsList = prefs.notificationsList as Notification[] | undefined;

  if (!notificationsList || !Array.isArray(notificationsList)) {
    return [];
  }

  return notificationsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const notifications = await getNotifications(userId);
  return notifications.filter((n) => !n.read).length;
}

/**
 * Mark notification as read
 */
export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  const notifications = (prefs.notificationsList as Notification[]) ?? [];

  const updatedNotifications = notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n));

  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...prefs,
        notificationsList: updatedNotifications,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  const notifications = (prefs.notificationsList as Notification[]) ?? [];

  const updatedNotifications = notifications.map((n) => ({ ...n, read: true }));

  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...prefs,
        notificationsList: updatedNotifications,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Clear old notifications (keep last 100)
 */
async function pruneNotifications(notifications: Notification[]): Promise<Notification[]> {
  const MAX_NOTIFICATIONS = 100;

  if (notifications.length <= MAX_NOTIFICATIONS) {
    return notifications;
  }

  // Sort by date descending and keep only the most recent
  const sorted = [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return sorted.slice(0, MAX_NOTIFICATIONS);
}

/**
 * Send notification to a single user
 */
export async function sendNotification(input: SendNotificationInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, type, title, message, leagueId, leagueSlug, link } = input;

    // Get user preferences
    const prefs = await getNotificationPreferences(userId);
    const channels = shouldSendNotification(prefs, type);

    // Create notification object
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      title,
      message,
      leagueId,
      leagueSlug,
      link,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Store in-app notification
    if (channels.inApp) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });

      const userPrefs = (user?.preferences as Record<string, unknown>) ?? {};
      const existingNotifications = (userPrefs.notificationsList as Notification[]) ?? [];

      const updatedNotifications = await pruneNotifications([notification, ...existingNotifications]);

      await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: {
            ...userPrefs,
            notificationsList: updatedNotifications,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // Send email notification if enabled
    if (channels.email && isEmailEnabled()) {
      await sendEmailNotificationByType(userId, type, title, message, leagueSlug, link);
    }

    // Send push notification if enabled
    if (channels.push) {
      await sendPushNotification(userId, title, message, link);
    }

    return { success: true };
  } catch (error) {
    console.error('[Notification] Failed to send notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send notification to multiple users
 */
export async function sendBulkNotification(
  input: SendBulkNotificationInput
): Promise<{ success: boolean; sent: number; failed: number }> {
  const { userIds, ...notificationData } = input;

  let sent = 0;
  let failed = 0;

  // Send notifications in parallel with concurrency limit
  const BATCH_SIZE = 10;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map((userId) =>
        sendNotification({
          userId,
          ...notificationData,
        })
      )
    );

    results.forEach((result) => {
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    });
  }

  return { success: failed === 0, sent, failed };
}

/**
 * Send email notification based on type
 * Routes to the appropriate email template
 */
async function sendEmailNotificationByType(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  leagueSlug?: string,
  _link?: string
): Promise<void> {
  // Get user email and name
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user?.email) {
    console.warn(`[Email] User ${userId} has no email address`);
    return;
  }

  const userName = user.name || 'Fantasy Manager';

  // Get league info if available
  let leagueName = 'Your League';
  if (leagueSlug) {
    const league = await prisma.league.findUnique({
      where: { slug: leagueSlug },
      select: { name: true },
    });
    if (league) {
      leagueName = league.name;
    }
  }

  // Route to appropriate email template based on type
  // For generic notifications, we log them (could add a generic template)
  switch (type) {
    case 'membership_approved':
      if (leagueSlug) {
        await sendMembershipApprovedEmail({
          to: user.email,
          userName,
          leagueName,
          leagueSlug,
        });
      }
      break;

    case 'team_claimed':
      // Team claimed emails are sent directly from the claim function with team info
      console.log(`[Email] Team claimed notification for ${user.email}: ${title}`);
      break;

    case 'power_rankings_published':
      // Power rankings emails are sent via notifyPowerRankingsPublished with week info
      console.log(`[Email] Power rankings notification for ${user.email}: ${title}`);
      break;

    default:
      // Log other notification types - they have specialized helper functions
      console.log(`[Email] ${type} notification for ${user.email}: ${title} - ${message}`);
  }
}

/**
 * Send push notification
 *
 * Ready for integration with push notification providers:
 * - OneSignal
 * - Firebase Cloud Messaging (FCM)
 * - Expo Push Notifications (for React Native)
 *
 * To enable, set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY environment variables
 */
async function sendPushNotification(userId: string, title: string, message: string, _link?: string): Promise<void> {
  // Check if push notifications are configured
  const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
  const oneSignalApiKey = process.env.ONESIGNAL_API_KEY;

  if (!oneSignalAppId || !oneSignalApiKey) {
    console.log(`[Push] Not configured. Would send to user ${userId}: ${title} - ${message}`);
    return;
  }

  try {
    // OneSignal API integration
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${oneSignalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        include_external_user_ids: [userId],
        headings: { en: title },
        contents: { en: message },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Push] Failed to send notification: ${error}`);
    }
  } catch (error) {
    console.error('[Push] Error sending notification:', error);
  }
}

// =============================================================================
// Helper functions for specific notification types
// =============================================================================

/**
 * Send stat correction notification
 */
export async function notifyStatCorrection(
  userId: string,
  leagueSlug: string,
  weekNumber: number,
  previousResult: boolean,
  newResult: boolean,
  matchupDescription?: string
): Promise<void> {
  const resultChange = previousResult !== newResult;
  const message = resultChange
    ? `A stat correction in Week ${weekNumber} has changed one of your pick results from ${previousResult ? 'correct' : 'incorrect'} to ${newResult ? 'correct' : 'incorrect'}.`
    : `A stat correction was applied to Week ${weekNumber}, but your pick results remain unchanged.`;

  // Send in-app notification
  await sendNotification({
    userId,
    type: 'stat_correction',
    title: 'Stat Correction Applied',
    message,
    leagueSlug,
    link: `/leagues/${leagueSlug}/pickems`,
  });

  // Send email notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, preferences: true },
  });

  if (user?.email) {
    const prefs = await getNotificationPreferences(userId);
    if (prefs.emailNotifications) {
      const league = await prisma.league.findUnique({
        where: { slug: leagueSlug },
        select: { name: true },
      });

      await sendStatCorrectionEmail({
        to: user.email,
        userName: user.name || 'Fantasy Manager',
        leagueName: league?.name || 'Your League',
        leagueSlug,
        weekNumber,
        previousResult,
        newResult,
        matchupDescription,
      });
    }
  }
}

/**
 * Send pick reminder notification
 */
export async function notifyPickReminder(
  userId: string,
  leagueSlug: string,
  weekNumber: number,
  unpickedCount: number,
  totalMatchups?: number
): Promise<void> {
  // Send in-app notification
  await sendNotification({
    userId,
    type: 'pick_reminder',
    title: 'Pick Reminder',
    message: `You have ${unpickedCount} unpicked matchup${unpickedCount > 1 ? 's' : ''} for Week ${weekNumber}. Don't forget to make your picks!`,
    leagueSlug,
    link: `/leagues/${leagueSlug}/pickems`,
  });

  // Send email notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email) {
    const prefs = await getNotificationPreferences(userId);
    if (prefs.emailNotifications && prefs.pickReminders) {
      const league = await prisma.league.findUnique({
        where: { slug: leagueSlug },
        select: { name: true },
      });

      await sendPickReminderEmail({
        to: user.email,
        userName: user.name || 'Fantasy Manager',
        leagueName: league?.name || 'Your League',
        leagueSlug,
        weekNumber,
        unpickedCount,
        totalMatchups: totalMatchups || unpickedCount,
      });
    }
  }
}

/**
 * Send comment reply notification
 */
export async function notifyCommentReply(
  userId: string,
  leagueSlug: string,
  momentId: string,
  replierName: string,
  replyContent?: string
): Promise<void> {
  // Send in-app notification
  await sendNotification({
    userId,
    type: 'comment_reply',
    title: 'New Reply to Your Comment',
    message: `${replierName} replied to your comment.`,
    leagueSlug,
    link: `/leagues/${leagueSlug}/moment/${momentId}`,
  });

  // Send email notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email) {
    const prefs = await getNotificationPreferences(userId);
    if (prefs.emailNotifications) {
      const league = await prisma.league.findUnique({
        where: { slug: leagueSlug },
        select: { name: true },
      });

      await sendCommentReplyEmail({
        to: user.email,
        userName: user.name || 'Fantasy Manager',
        leagueName: league?.name || 'Your League',
        leagueSlug,
        momentId,
        replierName,
        replyPreview: replyContent?.substring(0, 200) || 'View the reply on FSHQ',
      });
    }
  }
}

/**
 * Send power rankings published notification to all league members
 */
export async function notifyPowerRankingsPublished(
  userIds: string[],
  leagueSlug: string,
  weekNumber: number
): Promise<void> {
  // Get league info
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { name: true },
  });

  const leagueName = league?.name || 'Your League';

  // Send bulk in-app notifications
  await sendBulkNotification({
    userIds,
    type: 'power_rankings_published',
    title: 'Power Rankings Published',
    message: `Week ${weekNumber} power rankings are now available!`,
    leagueSlug,
    link: `/leagues/${leagueSlug}/rankings`,
  });

  // Send email notifications to users who have them enabled
  for (const userId of userIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      const prefs = await getNotificationPreferences(userId);
      if (prefs.emailNotifications && prefs.leagueUpdates) {
        await sendPowerRankingsPublishedEmail({
          to: user.email,
          userName: user.name || 'Fantasy Manager',
          leagueName,
          leagueSlug,
          weekNumber,
        });
      }
    }
  }
}

/**
 * Send matchup result notification
 */
export async function notifyMatchupResult(
  userId: string,
  leagueSlug: string,
  weekNumber: number,
  won: boolean,
  opponentName: string,
  yourScore: number,
  opponentScore: number
): Promise<void> {
  const score = `${yourScore.toFixed(1)} - ${opponentScore.toFixed(1)}`;

  // Send in-app notification
  await sendNotification({
    userId,
    type: 'matchup_result',
    title: won ? 'Victory!' : 'Matchup Complete',
    message: won
      ? `Congratulations! You defeated ${opponentName} with a score of ${score} in Week ${weekNumber}.`
      : `Your Week ${weekNumber} matchup against ${opponentName} has ended. Final score: ${score}.`,
    leagueSlug,
    link: `/leagues/${leagueSlug}/matchups`,
  });

  // Send email notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email) {
    const prefs = await getNotificationPreferences(userId);
    if (prefs.emailNotifications) {
      const league = await prisma.league.findUnique({
        where: { slug: leagueSlug },
        select: { name: true },
      });

      await sendMatchupResultEmail({
        to: user.email,
        userName: user.name || 'Fantasy Manager',
        leagueName: league?.name || 'Your League',
        leagueSlug,
        weekNumber,
        won,
        opponentName,
        yourScore,
        opponentScore,
      });
    }
  }
}

/**
 * Send team claimed notification
 */
export async function notifyTeamClaimed(userId: string, leagueSlug: string, teamName: string): Promise<void> {
  // Send in-app notification
  await sendNotification({
    userId,
    type: 'team_claimed',
    title: 'Team Claimed Successfully',
    message: `You have successfully claimed ${teamName}!`,
    leagueSlug,
    link: `/leagues/${leagueSlug}/teams`,
  });

  // Send email notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email) {
    const prefs = await getNotificationPreferences(userId);
    if (prefs.emailNotifications) {
      const league = await prisma.league.findUnique({
        where: { slug: leagueSlug },
        select: { name: true },
      });

      await sendTeamClaimedEmail({
        to: user.email,
        userName: user.name || 'Fantasy Manager',
        leagueName: league?.name || 'Your League',
        leagueSlug,
        teamName,
      });
    }
  }
}

/**
 * Send membership approved notification
 */
export async function notifyMembershipApproved(userId: string, leagueSlug: string): Promise<void> {
  // Get league info
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { name: true },
  });

  const leagueName = league?.name || 'the league';

  // Send in-app notification
  await sendNotification({
    userId,
    type: 'membership_approved',
    title: 'Membership Approved',
    message: `Your request to join ${leagueName} has been approved!`,
    leagueSlug,
    link: `/leagues/${leagueSlug}/feed`,
  });

  // Send email notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email) {
    const prefs = await getNotificationPreferences(userId);
    if (prefs.emailNotifications && prefs.leagueUpdates) {
      await sendMembershipApprovedEmail({
        to: user.email,
        userName: user.name || 'Fantasy Manager',
        leagueName,
        leagueSlug,
      });
    }
  }
}
