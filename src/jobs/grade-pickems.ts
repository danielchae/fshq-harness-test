/**
 * Pick'ems Auto-Grading Job (task-51)
 *
 * Background job to automatically grade pick'em entries after games complete.
 * - Runs after matchup results sync from platform
 * - Compares user picks to actual winners
 * - Updates isCorrect and pointsEarned fields
 * - Triggers stats update via database trigger (task-16)
 *
 * Dependencies: task-11 (Pick'ems Entries and Grading Schema), task-16 (Database Triggers)
 */

import { prisma, withRetry } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface GradePicksResult {
  success: boolean;
  leagueId: string;
  weekNumber: number;
  totalPicks: number;
  correctPicks: number;
  incorrectPicks: number;
  error?: string;
}

export interface GradeMatchupResult {
  success: boolean;
  matchupId: string;
  picksGraded: number;
  correctPicks: number;
  incorrectPicks: number;
  error?: string;
}

export interface GradeAllResult {
  success: boolean;
  totalMatchups: number;
  totalPicksGraded: number;
  correctPicks: number;
  incorrectPicks: number;
  results: GradeMatchupResult[];
  errors: string[];
}

// ============================================================================
// Core Grading Functions
// ============================================================================

/**
 * Grade all picks for a specific matchup
 *
 * @param matchupId - The matchup ID to grade picks for
 * @returns GradeMatchupResult with grading statistics
 */
export async function gradePicksForMatchup(matchupId: string): Promise<GradeMatchupResult> {
  try {
    // Fetch the matchup with winner information
    const matchup = await withRetry(() =>
      prisma.matchup.findUnique({
        where: { id: matchupId },
        select: {
          id: true,
          winnerId: true,
          isComplete: true,
          leagueId: true,
          weekNumber: true,
        },
      })
    );

    if (!matchup) {
      return {
        success: false,
        matchupId,
        picksGraded: 0,
        correctPicks: 0,
        incorrectPicks: 0,
        error: `Matchup not found: ${matchupId}`,
      };
    }

    // Only grade if matchup is complete and has a winner
    if (!matchup.isComplete || !matchup.winnerId) {
      return {
        success: true,
        matchupId,
        picksGraded: 0,
        correctPicks: 0,
        incorrectPicks: 0,
        error: 'Matchup not complete or no winner determined',
      };
    }

    // Fetch all ungraded picks for this matchup
    const ungradedPicks = await withRetry(() =>
      prisma.pickemEntry.findMany({
        where: {
          matchupId: matchup.id,
          isCorrect: null, // Only ungraded picks
        },
        select: {
          id: true,
          predictedWinnerId: true,
          userId: true,
        },
      })
    );

    if (ungradedPicks.length === 0) {
      return {
        success: true,
        matchupId,
        picksGraded: 0,
        correctPicks: 0,
        incorrectPicks: 0,
      };
    }

    let correctCount = 0;
    let incorrectCount = 0;
    const now = new Date();

    // Grade each pick individually to trigger database triggers
    // Database triggers (task-16) update stats when isCorrect is set
    for (const pick of ungradedPicks) {
      const isCorrect = pick.predictedWinnerId === matchup.winnerId;
      const pointsEarned = isCorrect ? 1 : 0;

      await withRetry(() =>
        prisma.pickemEntry.update({
          where: { id: pick.id },
          data: {
            isCorrect,
            pointsEarned,
            gradedAt: now,
          },
        })
      );

      if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }

    return {
      success: true,
      matchupId,
      picksGraded: ungradedPicks.length,
      correctPicks: correctCount,
      incorrectPicks: incorrectCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GradePicks] Error grading matchup ${matchupId}:`, errorMessage);

    return {
      success: false,
      matchupId,
      picksGraded: 0,
      correctPicks: 0,
      incorrectPicks: 0,
      error: errorMessage,
    };
  }
}

/**
 * Grade all picks for a specific league and week
 *
 * @param leagueId - The league ID
 * @param weekNumber - The week number to grade
 * @returns GradePicksResult with grading statistics
 */
export async function gradePicksForLeagueWeek(
  leagueId: string,
  weekNumber: number
): Promise<GradePicksResult> {
  try {
    // Find all completed matchups for this league/week with winners
    const matchups = await withRetry(() =>
      prisma.matchup.findMany({
        where: {
          leagueId,
          weekNumber,
          isComplete: true,
          winnerId: { not: null },
        },
        select: {
          id: true,
          winnerId: true,
        },
      })
    );

    if (matchups.length === 0) {
      return {
        success: true,
        leagueId,
        weekNumber,
        totalPicks: 0,
        correctPicks: 0,
        incorrectPicks: 0,
      };
    }

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalGraded = 0;

    // Grade picks for each matchup
    for (const matchup of matchups) {
      const result = await gradePicksForMatchup(matchup.id);

      if (result.success) {
        totalGraded += result.picksGraded;
        totalCorrect += result.correctPicks;
        totalIncorrect += result.incorrectPicks;
      }
    }

    return {
      success: true,
      leagueId,
      weekNumber,
      totalPicks: totalGraded,
      correctPicks: totalCorrect,
      incorrectPicks: totalIncorrect,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GradePicks] Error grading league ${leagueId} week ${weekNumber}:`, errorMessage);

    return {
      success: false,
      leagueId,
      weekNumber,
      totalPicks: 0,
      correctPicks: 0,
      incorrectPicks: 0,
      error: errorMessage,
    };
  }
}

/**
 * Grade all pending picks across all leagues
 * This is the main entry point for the grading job
 *
 * @returns GradeAllResult with comprehensive grading statistics
 */
export async function gradeAllPendingPicks(): Promise<GradeAllResult> {
  const results: GradeMatchupResult[] = [];
  const errors: string[] = [];
  let totalPicksGraded = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;

  try {
    // Find all completed matchups with winners that have ungraded picks
    const matchupsWithUngradedPicks = await withRetry(() =>
      prisma.matchup.findMany({
        where: {
          isComplete: true,
          winnerId: { not: null },
          pickemEntries: {
            some: {
              isCorrect: null, // Has at least one ungraded pick
            },
          },
        },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
        },
        orderBy: [{ leagueId: 'asc' }, { weekNumber: 'asc' }],
      })
    );

    console.log(`[GradePicks] Found ${matchupsWithUngradedPicks.length} matchups with ungraded picks`);

    // Grade picks for each matchup
    for (const matchup of matchupsWithUngradedPicks) {
      const result = await gradePicksForMatchup(matchup.id);
      results.push(result);

      if (result.success) {
        totalPicksGraded += result.picksGraded;
        totalCorrect += result.correctPicks;
        totalIncorrect += result.incorrectPicks;
      } else if (result.error) {
        errors.push(`Matchup ${matchup.id}: ${result.error}`);
      }
    }

    console.log(
      `[GradePicks] Graded ${totalPicksGraded} picks: ${totalCorrect} correct, ${totalIncorrect} incorrect`
    );

    return {
      success: errors.length === 0,
      totalMatchups: matchupsWithUngradedPicks.length,
      totalPicksGraded,
      correctPicks: totalCorrect,
      incorrectPicks: totalIncorrect,
      results,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GradePicks] Error in gradeAllPendingPicks:', errorMessage);

    return {
      success: false,
      totalMatchups: 0,
      totalPicksGraded,
      correctPicks: totalCorrect,
      incorrectPicks: totalIncorrect,
      results,
      errors: [...errors, errorMessage],
    };
  }
}

// ============================================================================
// Batch Grading Functions
// ============================================================================

/**
 * Batch grade picks for multiple matchups efficiently
 * Uses individual updates to ensure database triggers fire
 *
 * @param matchupIds - Array of matchup IDs to grade
 * @returns GradeAllResult with grading statistics
 */
export async function batchGradePicks(matchupIds: string[]): Promise<GradeAllResult> {
  const results: GradeMatchupResult[] = [];
  const errors: string[] = [];
  let totalPicksGraded = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;

  for (const matchupId of matchupIds) {
    const result = await gradePicksForMatchup(matchupId);
    results.push(result);

    if (result.success) {
      totalPicksGraded += result.picksGraded;
      totalCorrect += result.correctPicks;
      totalIncorrect += result.incorrectPicks;
    } else if (result.error) {
      errors.push(`Matchup ${matchupId}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    totalMatchups: matchupIds.length,
    totalPicksGraded,
    correctPicks: totalCorrect,
    incorrectPicks: totalIncorrect,
    results,
    errors,
  };
}

// ============================================================================
// Integration with Sync Jobs
// ============================================================================

/**
 * Hook to run grading after matchup sync completes
 * Called from sync jobs when matchup results are updated
 *
 * @param leagueId - The league that was synced
 * @param weekNumber - The week that was synced
 */
export async function onMatchupSyncComplete(leagueId: string, weekNumber: number): Promise<void> {
  console.log(`[GradePicks] Triggered grading for league ${leagueId} week ${weekNumber}`);

  const result = await gradePicksForLeagueWeek(leagueId, weekNumber);

  if (result.success) {
    console.log(
      `[GradePicks] League ${leagueId} week ${weekNumber}: ` +
        `${result.totalPicks} picks graded (${result.correctPicks} correct, ${result.incorrectPicks} incorrect)`
    );
  } else {
    console.error(`[GradePicks] League ${leagueId} week ${weekNumber} failed: ${result.error}`);
  }
}

/**
 * Run the full grading job
 * Entry point for scheduled/manual execution
 */
export async function runGradingJob(): Promise<GradeAllResult> {
  console.log('[GradePicks] Starting grading job...');
  const startTime = Date.now();

  const result = await gradeAllPendingPicks();

  const duration = Date.now() - startTime;
  console.log(`[GradePicks] Grading job completed in ${duration}ms`);
  console.log(
    `[GradePicks] Summary: ${result.totalMatchups} matchups, ` +
      `${result.totalPicksGraded} picks graded, ` +
      `${result.correctPicks} correct, ${result.incorrectPicks} incorrect`
  );

  if (result.errors.length > 0) {
    console.error('[GradePicks] Errors encountered:', result.errors);
  }

  return result;
}
