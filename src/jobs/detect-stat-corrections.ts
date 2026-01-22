/**
 * Stat Correction Detection Job (task-52)
 *
 * Background job to detect stat corrections in completed matchups and re-grade affected picks.
 * - Monitors for score changes after initial matchup completion
 * - Re-grades pick'ems if matchup winner changes
 * - Notifies affected users of stat correction
 * - Updates leaderboard with corrected scores
 *
 * Dependencies: task-10 (Matchups Schema), task-51 (Pick'ems Auto-Grading Job)
 */

import { prisma, withRetry } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface StatCorrectionResult {
  success: boolean;
  matchupId: string;
  weekNumber: number;
  leagueId: string;
  originalWinnerId: string | null;
  newWinnerId: string | null;
  winnerChanged: boolean;
  picksAffected: number;
  picksRegraded: number;
  error?: string;
}

export interface DetectCorrectionsResult {
  success: boolean;
  totalMatchupsChecked: number;
  correctionsDetected: number;
  picksRegraded: number;
  notificationsSent: number;
  results: StatCorrectionResult[];
  errors: string[];
}

export interface AffectedUser {
  userId: string;
  email: string | null;
  name: string | null;
  pickId: string;
  previousResult: boolean | null;
  newResult: boolean;
  weekNumber: number;
  leagueId: string;
}

export interface NotificationPayload {
  userId: string;
  type: 'stat_correction';
  message: string;
  data: {
    matchupId: string;
    weekNumber: number;
    leagueId: string;
    previousResult: boolean | null;
    newResult: boolean;
  };
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Correction window in milliseconds (3 days)
 * Only matchups completed within this window are checked for corrections
 */
const CORRECTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

// ============================================================================
// Core Detection Functions
// ============================================================================

/**
 * Detects if a matchup has had a stat correction that changed the winner
 *
 * @param matchupId - The matchup ID to check
 * @param newHomeScore - Updated home score from platform
 * @param newAwayScore - Updated away score from platform
 * @returns StatCorrectionResult with correction details
 */
export async function detectStatCorrection(
  matchupId: string,
  newHomeScore: number,
  newAwayScore: number
): Promise<StatCorrectionResult> {
  try {
    const matchup = await withRetry(() =>
      prisma.matchup.findUnique({
        where: { id: matchupId },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          winnerId: true,
          isComplete: true,
          completedAt: true,
          lastScoreUpdate: true,
        },
      })
    );

    if (!matchup) {
      return {
        success: false,
        matchupId,
        weekNumber: 0,
        leagueId: '',
        originalWinnerId: null,
        newWinnerId: null,
        winnerChanged: false,
        picksAffected: 0,
        picksRegraded: 0,
        error: `Matchup not found: ${matchupId}`,
      };
    }

    if (!matchup.isComplete) {
      return {
        success: true,
        matchupId,
        weekNumber: matchup.weekNumber,
        leagueId: matchup.leagueId,
        originalWinnerId: matchup.winnerId,
        newWinnerId: matchup.winnerId,
        winnerChanged: false,
        picksAffected: 0,
        picksRegraded: 0,
      };
    }

    // Determine new winner based on corrected scores
    let newWinnerId: string | null = null;
    if (newHomeScore > newAwayScore) {
      newWinnerId = matchup.homeTeamId;
    } else if (newAwayScore > newHomeScore) {
      newWinnerId = matchup.awayTeamId;
    }
    // If scores are equal, newWinnerId stays null (tie)

    const winnerChanged = matchup.winnerId !== newWinnerId;

    if (!winnerChanged) {
      // Update scores but no winner change
      await withRetry(() =>
        prisma.matchup.update({
          where: { id: matchupId },
          data: {
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            lastScoreUpdate: new Date(),
          },
        })
      );

      return {
        success: true,
        matchupId,
        weekNumber: matchup.weekNumber,
        leagueId: matchup.leagueId,
        originalWinnerId: matchup.winnerId,
        newWinnerId,
        winnerChanged: false,
        picksAffected: 0,
        picksRegraded: 0,
      };
    }

    // Winner changed - this is a stat correction!
    console.log(`[StatCorrection] Winner changed for matchup ${matchupId}: ${matchup.winnerId} -> ${newWinnerId}`);

    // Update matchup with correction info
    await withRetry(() =>
      prisma.matchup.update({
        where: { id: matchupId },
        data: {
          homeScore: newHomeScore,
          awayScore: newAwayScore,
          winnerId: newWinnerId,
          previousWinnerId: matchup.winnerId,
          lastScoreUpdate: new Date(),
          statCorrectionAt: new Date(),
        },
      })
    );

    // Re-grade affected picks
    const regradeResult = await regradePicksForMatchup(matchupId, newWinnerId);

    return {
      success: true,
      matchupId,
      weekNumber: matchup.weekNumber,
      leagueId: matchup.leagueId,
      originalWinnerId: matchup.winnerId,
      newWinnerId,
      winnerChanged: true,
      picksAffected: regradeResult.picksAffected,
      picksRegraded: regradeResult.picksRegraded,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[StatCorrection] Error detecting correction for matchup ${matchupId}:`, errorMessage);

    return {
      success: false,
      matchupId,
      weekNumber: 0,
      leagueId: '',
      originalWinnerId: null,
      newWinnerId: null,
      winnerChanged: false,
      picksAffected: 0,
      picksRegraded: 0,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Re-grading Functions
// ============================================================================

/**
 * Re-grades all picks for a matchup after a stat correction
 *
 * @param matchupId - The matchup ID
 * @param newWinnerId - The new winner after correction
 * @returns Number of picks affected and regraded
 */
export async function regradePicksForMatchup(
  matchupId: string,
  newWinnerId: string | null
): Promise<{ picksAffected: number; picksRegraded: number }> {
  try {
    // Get all picks for this matchup that have been graded
    const picks = await withRetry(() =>
      prisma.pickemEntry.findMany({
        where: {
          matchupId,
          isCorrect: { not: null }, // Only previously graded picks
        },
        select: {
          id: true,
          userId: true,
          predictedWinnerId: true,
          isCorrect: true,
          pointsEarned: true,
        },
      })
    );

    if (picks.length === 0) {
      return { picksAffected: 0, picksRegraded: 0 };
    }

    const now = new Date();
    let regraded = 0;

    for (const pick of picks) {
      // Handle tie (newWinnerId is null)
      // In a tie, all picks are considered incorrect
      const newIsCorrect = newWinnerId !== null && pick.predictedWinnerId === newWinnerId;
      const newPointsEarned = newIsCorrect ? 1 : 0;

      // Only update if the result changed
      if (pick.isCorrect !== newIsCorrect) {
        await withRetry(() =>
          prisma.pickemEntry.update({
            where: { id: pick.id },
            data: {
              isCorrect: newIsCorrect,
              pointsEarned: newPointsEarned,
              gradedAt: now,
            },
          })
        );
        regraded++;
      }
    }

    console.log(`[StatCorrection] Regraded ${regraded}/${picks.length} picks for matchup ${matchupId}`);

    return { picksAffected: picks.length, picksRegraded: regraded };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[StatCorrection] Error regrading picks for matchup ${matchupId}:`, errorMessage);
    return { picksAffected: 0, picksRegraded: 0 };
  }
}

// ============================================================================
// User Notification Functions
// ============================================================================

/**
 * Finds all users affected by a stat correction
 *
 * @param matchupId - The matchup ID
 * @param newWinnerId - The new winner after correction
 * @returns Array of affected users with their pick details
 */
export async function findAffectedUsers(matchupId: string, newWinnerId: string | null): Promise<AffectedUser[]> {
  try {
    const matchup = await withRetry(() =>
      prisma.matchup.findUnique({
        where: { id: matchupId },
        select: {
          weekNumber: true,
          leagueId: true,
          previousWinnerId: true,
        },
      })
    );

    if (!matchup) {
      return [];
    }

    // Get all picks whose correctness changed
    const picks = await withRetry(() =>
      prisma.pickemEntry.findMany({
        where: {
          matchupId,
          isCorrect: { not: null },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      })
    );

    const affectedUsers: AffectedUser[] = [];

    for (const pick of picks) {
      // Determine what the old result would have been
      const oldIsCorrect = matchup.previousWinnerId !== null && pick.predictedWinnerId === matchup.previousWinnerId;

      // Current result
      const newIsCorrect = newWinnerId !== null && pick.predictedWinnerId === newWinnerId;

      // Only include if result changed
      if (oldIsCorrect !== newIsCorrect) {
        affectedUsers.push({
          userId: pick.userId,
          email: pick.user.email,
          name: pick.user.name,
          pickId: pick.id,
          previousResult: oldIsCorrect,
          newResult: newIsCorrect,
          weekNumber: matchup.weekNumber,
          leagueId: matchup.leagueId,
        });
      }
    }

    return affectedUsers;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[StatCorrection] Error finding affected users for matchup ${matchupId}:`, errorMessage);
    return [];
  }
}

/**
 * Creates notification payloads for affected users
 *
 * @param affectedUsers - Array of affected users
 * @param matchupId - The matchup ID
 * @returns Array of notification payloads
 */
export function createNotificationPayloads(affectedUsers: AffectedUser[], matchupId: string): NotificationPayload[] {
  return affectedUsers.map((user) => {
    const message = user.newResult
      ? `Good news! A stat correction changed the outcome of Week ${user.weekNumber}. Your pick is now correct!`
      : `A stat correction changed the outcome of Week ${user.weekNumber}. Your pick is now incorrect.`;

    return {
      userId: user.userId,
      type: 'stat_correction' as const,
      message,
      data: {
        matchupId,
        weekNumber: user.weekNumber,
        leagueId: user.leagueId,
        previousResult: user.previousResult,
        newResult: user.newResult,
      },
    };
  });
}

/**
 * Sends notifications to affected users
 * Uses the notification service for in-app, email, and push notifications
 *
 * @param notifications - Array of notification payloads
 * @returns Number of notifications sent
 */
export async function sendNotifications(notifications: NotificationPayload[]): Promise<number> {
  const { notifyStatCorrection } = await import('@/lib/notifications');

  let sentCount = 0;

  for (const notification of notifications) {
    try {
      // Get league slug for the notification link
      const league = await prisma.league.findUnique({
        where: { id: notification.data?.leagueId },
        select: { slug: true },
      });

      if (league?.slug && notification.data) {
        await notifyStatCorrection(
          notification.userId,
          league.slug,
          notification.data.weekNumber,
          notification.data.previousResult ?? false,
          notification.data.newResult
        );
        sentCount++;
      }
    } catch (error) {
      console.error(`[StatCorrection] Failed to send notification to user ${notification.userId}:`, error);
    }
  }

  return sentCount;
}

// ============================================================================
// Leaderboard Update Functions
// ============================================================================

/**
 * Updates season stats after stat corrections
 *
 * @param leagueId - The league ID
 * @param season - The season year
 * @param affectedUserIds - Array of affected user IDs
 */
export async function updateLeaderboardStats(
  leagueId: string,
  season: number,
  affectedUserIds: string[]
): Promise<void> {
  try {
    for (const userId of affectedUserIds) {
      // Recalculate stats from picks
      const picks = await withRetry(() =>
        prisma.pickemEntry.findMany({
          where: {
            userId,
            leagueId,
            season,
            isCorrect: { not: null },
          },
          select: {
            isCorrect: true,
            pointsEarned: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        })
      );

      const totalPicks = picks.length;
      const correctPicks = picks.filter((p) => p.isCorrect === true).length;
      const accuracy = totalPicks > 0 ? correctPicks / totalPicks : 0;

      // Calculate streaks
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;

      for (const pick of picks) {
        if (pick.isCorrect) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      // Current streak is from the end
      for (let i = picks.length - 1; i >= 0; i--) {
        if (picks[i]?.isCorrect) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Update or create season stats
      await withRetry(() =>
        prisma.seasonStats.upsert({
          where: {
            user_league_season_stats_unique: {
              userId,
              leagueId,
              season,
            },
          },
          create: {
            userId,
            leagueId,
            season,
            totalPicks,
            correctPicks,
            accuracy,
            currentStreak,
            longestStreak,
          },
          update: {
            totalPicks,
            correctPicks,
            accuracy,
            currentStreak,
            longestStreak,
          },
        })
      );

      console.log(
        `[StatCorrection] Updated stats for user ${userId}: ${correctPicks}/${totalPicks} (${(accuracy * 100).toFixed(1)}%)`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[StatCorrection] Error updating leaderboard stats:`, errorMessage);
  }
}

// ============================================================================
// Main Job Functions
// ============================================================================

/**
 * Scans for matchups within the correction window that may have stat corrections
 * Called by sync jobs to check for score changes
 *
 * @returns DetectCorrectionsResult with detection statistics
 */
export async function scanForStatCorrections(): Promise<DetectCorrectionsResult> {
  const results: StatCorrectionResult[] = [];
  const errors: string[] = [];
  const totalPicksRegraded = 0;
  const totalNotificationsSent = 0;
  const correctionsDetected = 0;

  try {
    const correctionWindowStart = new Date(Date.now() - CORRECTION_WINDOW_MS);

    // Find completed matchups within the correction window
    const eligibleMatchups = await withRetry(() =>
      prisma.matchup.findMany({
        where: {
          isComplete: true,
          completedAt: { gte: correctionWindowStart },
        },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
          homeScore: true,
          awayScore: true,
          winnerId: true,
          season: true,
        },
        orderBy: { completedAt: 'desc' },
      })
    );

    console.log(`[StatCorrection] Found ${eligibleMatchups.length} matchups in correction window`);

    // Note: In a real implementation, we would fetch updated scores from the platform
    // For now, this function serves as a framework for when scores are updated
    // The actual correction detection happens when syncMatchupScores is called

    return {
      success: true,
      totalMatchupsChecked: eligibleMatchups.length,
      correctionsDetected,
      picksRegraded: totalPicksRegraded,
      notificationsSent: totalNotificationsSent,
      results,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[StatCorrection] Error scanning for corrections:', errorMessage);

    return {
      success: false,
      totalMatchupsChecked: 0,
      correctionsDetected,
      picksRegraded: totalPicksRegraded,
      notificationsSent: totalNotificationsSent,
      results,
      errors: [...errors, errorMessage],
    };
  }
}

/**
 * Processes a batch of score updates and detects stat corrections
 * Called when platform sync provides updated scores
 *
 * @param scoreUpdates - Array of matchup IDs with new scores
 * @returns DetectCorrectionsResult with processing statistics
 */
export async function processScoreUpdates(
  scoreUpdates: {
    matchupId: string;
    homeScore: number;
    awayScore: number;
  }[]
): Promise<DetectCorrectionsResult> {
  const results: StatCorrectionResult[] = [];
  const errors: string[] = [];
  let totalPicksRegraded = 0;
  let totalNotificationsSent = 0;
  let correctionsDetected = 0;

  try {
    for (const update of scoreUpdates) {
      const result = await detectStatCorrection(update.matchupId, update.homeScore, update.awayScore);

      results.push(result);

      if (result.success && result.winnerChanged) {
        correctionsDetected++;
        totalPicksRegraded += result.picksRegraded;

        // Get matchup details for notifications and stats
        const matchup = await withRetry(() =>
          prisma.matchup.findUnique({
            where: { id: update.matchupId },
            select: { leagueId: true, season: true },
          })
        );

        if (matchup) {
          // Find and notify affected users
          const affectedUsers = await findAffectedUsers(update.matchupId, result.newWinnerId);
          const notifications = createNotificationPayloads(affectedUsers, update.matchupId);
          const sent = await sendNotifications(notifications);
          totalNotificationsSent += sent;

          // Update leaderboard stats
          const affectedUserIds = [...new Set(affectedUsers.map((u) => u.userId))];
          await updateLeaderboardStats(matchup.leagueId, matchup.season, affectedUserIds);
        }
      }

      if (!result.success && result.error) {
        errors.push(`Matchup ${update.matchupId}: ${result.error}`);
      }
    }

    console.log(
      `[StatCorrection] Processed ${scoreUpdates.length} updates: ${correctionsDetected} corrections, ${totalPicksRegraded} picks regraded`
    );

    return {
      success: errors.length === 0,
      totalMatchupsChecked: scoreUpdates.length,
      correctionsDetected,
      picksRegraded: totalPicksRegraded,
      notificationsSent: totalNotificationsSent,
      results,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[StatCorrection] Error processing score updates:', errorMessage);

    return {
      success: false,
      totalMatchupsChecked: scoreUpdates.length,
      correctionsDetected,
      picksRegraded: totalPicksRegraded,
      notificationsSent: totalNotificationsSent,
      results,
      errors: [...errors, errorMessage],
    };
  }
}

/**
 * Hook to run stat correction detection after matchup sync
 * Called from sync jobs when matchup scores are updated
 *
 * @param matchupId - The matchup that was synced
 * @param newHomeScore - Updated home score
 * @param newAwayScore - Updated away score
 */
export async function onMatchupScoreSync(matchupId: string, newHomeScore: number, newAwayScore: number): Promise<void> {
  console.log(`[StatCorrection] Checking matchup ${matchupId} for corrections`);

  const result = await detectStatCorrection(matchupId, newHomeScore, newAwayScore);

  if (result.success && result.winnerChanged) {
    console.log(
      `[StatCorrection] Correction detected for matchup ${matchupId}: ` +
        `Winner changed from ${result.originalWinnerId} to ${result.newWinnerId}, ` +
        `${result.picksRegraded} picks regraded`
    );

    // Get matchup for additional processing
    const matchup = await withRetry(() =>
      prisma.matchup.findUnique({
        where: { id: matchupId },
        select: { leagueId: true, season: true },
      })
    );

    if (matchup) {
      // Notify affected users
      const affectedUsers = await findAffectedUsers(matchupId, result.newWinnerId);
      const notifications = createNotificationPayloads(affectedUsers, matchupId);
      await sendNotifications(notifications);

      // Update leaderboard
      const affectedUserIds = [...new Set(affectedUsers.map((u) => u.userId))];
      await updateLeaderboardStats(matchup.leagueId, matchup.season, affectedUserIds);
    }
  }
}

/**
 * Run the full stat correction detection job
 * Entry point for scheduled/manual execution
 */
export async function runStatCorrectionJob(): Promise<DetectCorrectionsResult> {
  console.log('[StatCorrection] Starting stat correction detection job...');
  const startTime = Date.now();

  const result = await scanForStatCorrections();

  const duration = Date.now() - startTime;
  console.log(`[StatCorrection] Job completed in ${duration}ms`);
  console.log(
    `[StatCorrection] Summary: ${result.totalMatchupsChecked} matchups checked, ` +
      `${result.correctionsDetected} corrections detected, ` +
      `${result.picksRegraded} picks regraded, ` +
      `${result.notificationsSent} notifications sent`
  );

  if (result.errors.length > 0) {
    console.error('[StatCorrection] Errors encountered:', result.errors);
  }

  return result;
}
