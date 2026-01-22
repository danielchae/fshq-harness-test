/**
 * Automated Moment Generation Job (task-53)
 *
 * Background job to auto-generate moments for notable events in fantasy leagues.
 * - Detects notable transactions (big trades, waiver pickups)
 * - Detects blowout games and close finishes
 * - Generates moments with templated content
 * - Posts to league feed automatically
 *
 * Dependencies: task-07 (Moments Schema), task-13 (Transactions Schema)
 */

import { prisma, withRetry } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface MomentGenerationResult {
  success: boolean;
  momentId?: string;
  leagueId: string;
  momentType: string;
  error?: string;
}

export interface GenerateMomentsResult {
  success: boolean;
  totalMatchupsChecked: number;
  totalTransactionsChecked: number;
  momentsCreated: number;
  blowoutMoments: number;
  closeGameMoments: number;
  transactionMoments: number;
  results: MomentGenerationResult[];
  errors: string[];
}

export interface LeagueSettings {
  leagueId: string;
  autoMomentsEnabled: boolean;
  blowoutThreshold: number;
  closeGameThreshold: number;
}

export interface NotableMatchup {
  matchupId: string;
  leagueId: string;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore: number;
  awayScore: number;
  winnerId: string;
  margin: number;
  eventType: 'blowout_game' | 'close_game';
}

export interface NotableTransaction {
  transactionId: string;
  leagueId: string;
  weekNumber: number;
  type: string;
  playerName: string;
  playerPosition?: string;
  teamId: string;
  teamName?: string;
  tradePartnerTeamId?: string;
  tradePartnerTeamName?: string;
  faabAmount?: number;
  eventType: 'notable_trade' | 'big_waiver' | 'blockbuster_trade';
}

// ============================================================================
// Configuration
// ============================================================================

/** Default threshold for blowout games (point margin) */
const DEFAULT_BLOWOUT_THRESHOLD = 50;

/** Default threshold for close games (point margin) */
const DEFAULT_CLOSE_GAME_THRESHOLD = 1;

/** High-value positions for notable transactions */
const HIGH_VALUE_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

// ============================================================================
// Content Templates
// ============================================================================

/**
 * Template for blowout game moments
 */
export function blowoutTemplate(winnerName: string, loserName: string, margin: number): string {
  return `🔥 BLOWOUT ALERT! ${winnerName} absolutely destroyed ${loserName} by ${margin.toFixed(1)} points!`;
}

/**
 * Template for close game (nail-biter) moments
 */
export function nailBiterTemplate(winnerName: string, loserName: string, margin: number): string {
  return `😱 NAIL BITER! ${winnerName} barely escapes ${loserName} by just ${margin.toFixed(1)} points!`;
}

/**
 * Template for blockbuster trade moments
 */
export function tradeTemplate(playerName: string, team1: string, team2: string): string {
  return `💰 BLOCKBUSTER TRADE! ${playerName} has been traded from ${team1} to ${team2}!`;
}

/**
 * Template for notable waiver pickup moments
 */
export function waiverTemplate(playerName: string, teamName: string, faabAmount?: number): string {
  if (faabAmount && faabAmount > 0) {
    return `🎯 WAIVER WIRE WIN! ${teamName} snags ${playerName} for $${faabAmount} FAAB!`;
  }
  return `🎯 WAIVER WIRE WIN! ${teamName} picks up ${playerName}!`;
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detects if a matchup qualifies as a blowout game
 */
export function detectBlowoutGame(
  homeScore: number,
  awayScore: number,
  threshold: number = DEFAULT_BLOWOUT_THRESHOLD
): { isBlowout: boolean; margin: number } {
  const margin = Math.abs(homeScore - awayScore);
  return {
    isBlowout: margin > threshold,
    margin,
  };
}

/**
 * Detects if a matchup qualifies as a close game (nail-biter)
 */
export function detectCloseGame(
  homeScore: number,
  awayScore: number,
  threshold: number = DEFAULT_CLOSE_GAME_THRESHOLD
): { isClose: boolean; margin: number } {
  const margin = Math.abs(homeScore - awayScore);
  return {
    isClose: margin < threshold,
    margin,
  };
}

/**
 * Detects if a transaction is notable enough to generate a moment
 * Returns the event type if notable, null otherwise
 */
export function detectNotableTransaction(
  type: string,
  playerPosition: string | null,
  isNotable: boolean,
  faabAmount: number | null
): 'notable_trade' | 'big_waiver' | 'blockbuster_trade' | null {
  // Check if marked as notable
  if (isNotable) {
    if (type === 'trade') {
      return 'blockbuster_trade';
    }
    return 'notable_trade';
  }

  // High-value player trade
  if (type === 'trade' && playerPosition && HIGH_VALUE_POSITIONS.includes(playerPosition)) {
    return 'notable_trade';
  }

  // Big FAAB waiver claim (>50% of typical budget assumed to be $100)
  if ((type === 'waiver' || type === 'add') && faabAmount && faabAmount >= 50) {
    return 'big_waiver';
  }

  return null;
}

// ============================================================================
// Deduplication Functions
// ============================================================================

/**
 * Checks if a moment already exists for a matchup-based event
 */
export async function matchupMomentExists(
  leagueId: string,
  matchupId: string,
  momentType: string
): Promise<boolean> {
  const existing = await withRetry(() =>
    prisma.moment.findFirst({
      where: {
        leagueId,
        sourceMatchupId: matchupId,
        momentType,
      },
      select: { id: true },
    })
  );

  return !!existing;
}

/**
 * Checks if a moment already exists for a transaction-based event
 */
export async function transactionMomentExists(
  leagueId: string,
  transactionId: string,
  momentType: string
): Promise<boolean> {
  const existing = await withRetry(() =>
    prisma.moment.findFirst({
      where: {
        leagueId,
        sourceTransactionId: transactionId,
        momentType,
      },
      select: { id: true },
    })
  );

  return !!existing;
}

// ============================================================================
// Moment Creation Functions
// ============================================================================

/**
 * Creates an auto-generated moment for a matchup event
 */
export async function createMatchupMoment(
  matchup: NotableMatchup,
  systemUserId: string
): Promise<MomentGenerationResult> {
  try {
    // Check for duplicate
    const exists = await matchupMomentExists(matchup.leagueId, matchup.matchupId, matchup.eventType);
    if (exists) {
      return {
        success: true,
        leagueId: matchup.leagueId,
        momentType: matchup.eventType,
        error: 'Moment already exists for this matchup',
      };
    }

    // Determine winner and loser names
    const winnerName = matchup.winnerId === matchup.homeTeamId
      ? (matchup.homeTeamName || 'Home Team')
      : (matchup.awayTeamName || 'Away Team');
    const loserName = matchup.winnerId === matchup.homeTeamId
      ? (matchup.awayTeamName || 'Away Team')
      : (matchup.homeTeamName || 'Home Team');

    // Generate content based on event type
    const content = matchup.eventType === 'blowout_game'
      ? blowoutTemplate(winnerName, loserName, matchup.margin)
      : nailBiterTemplate(winnerName, loserName, matchup.margin);

    // Create the moment
    const moment = await withRetry(() =>
      prisma.moment.create({
        data: {
          leagueId: matchup.leagueId,
          authorId: systemUserId,
          type: 'matchResult',
          content,
          isAutoGenerated: true,
          momentType: matchup.eventType,
          sourceMatchupId: matchup.matchupId,
          metadata: {
            matchupId: matchup.matchupId,
            weekNumber: matchup.weekNumber,
            winnerTeamId: matchup.winnerId,
            loserTeamId: matchup.winnerId === matchup.homeTeamId ? matchup.awayTeamId : matchup.homeTeamId,
            margin: matchup.margin,
            homeScore: matchup.homeScore,
            awayScore: matchup.awayScore,
          },
          isPinned: false,
          isHidden: false,
          lastActivityAt: new Date(),
        },
        select: { id: true },
      })
    );

    console.log(`[GenerateMoments] Created ${matchup.eventType} moment for matchup ${matchup.matchupId}`);

    return {
      success: true,
      momentId: moment.id,
      leagueId: matchup.leagueId,
      momentType: matchup.eventType,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GenerateMoments] Error creating matchup moment:`, errorMessage);

    return {
      success: false,
      leagueId: matchup.leagueId,
      momentType: matchup.eventType,
      error: errorMessage,
    };
  }
}

/**
 * Creates an auto-generated moment for a transaction event
 */
export async function createTransactionMoment(
  transaction: NotableTransaction,
  systemUserId: string
): Promise<MomentGenerationResult> {
  try {
    // Check for duplicate
    const exists = await transactionMomentExists(
      transaction.leagueId,
      transaction.transactionId,
      transaction.eventType
    );
    if (exists) {
      return {
        success: true,
        leagueId: transaction.leagueId,
        momentType: transaction.eventType,
        error: 'Moment already exists for this transaction',
      };
    }

    // Generate content based on event type
    let content: string;
    if (transaction.eventType === 'blockbuster_trade' || transaction.eventType === 'notable_trade') {
      content = tradeTemplate(
        transaction.playerName,
        transaction.teamName || 'Team A',
        transaction.tradePartnerTeamName || 'Team B'
      );
    } else {
      content = waiverTemplate(
        transaction.playerName,
        transaction.teamName || 'Unknown Team',
        transaction.faabAmount ?? undefined
      );
    }

    // Create the moment
    const moment = await withRetry(() =>
      prisma.moment.create({
        data: {
          leagueId: transaction.leagueId,
          authorId: systemUserId,
          type: 'transaction',
          content,
          isAutoGenerated: true,
          momentType: transaction.eventType,
          sourceTransactionId: transaction.transactionId,
          metadata: {
            transactionId: transaction.transactionId,
            weekNumber: transaction.weekNumber,
            transactionType: transaction.type,
            playerName: transaction.playerName,
            playerPosition: transaction.playerPosition,
            teamId: transaction.teamId,
            tradePartnerTeamId: transaction.tradePartnerTeamId,
            faabAmount: transaction.faabAmount,
          },
          isPinned: false,
          isHidden: false,
          lastActivityAt: new Date(),
        },
        select: { id: true },
      })
    );

    console.log(`[GenerateMoments] Created ${transaction.eventType} moment for transaction ${transaction.transactionId}`);

    return {
      success: true,
      momentId: moment.id,
      leagueId: transaction.leagueId,
      momentType: transaction.eventType,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GenerateMoments] Error creating transaction moment:`, errorMessage);

    return {
      success: false,
      leagueId: transaction.leagueId,
      momentType: transaction.eventType,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Batch Processing Functions
// ============================================================================

/**
 * Gets league settings for auto-moment generation
 */
export async function getLeagueSettings(leagueId: string): Promise<LeagueSettings> {
  const settings = await withRetry(() =>
    prisma.leagueSettings.findUnique({
      where: { leagueId },
      select: {
        leagueId: true,
        autoMomentsEnabled: true,
        blowoutThreshold: true,
        closeGameThreshold: true,
      },
    })
  );

  return {
    leagueId,
    autoMomentsEnabled: settings?.autoMomentsEnabled ?? true,
    blowoutThreshold: settings?.blowoutThreshold ?? DEFAULT_BLOWOUT_THRESHOLD,
    closeGameThreshold: settings?.closeGameThreshold ?? DEFAULT_CLOSE_GAME_THRESHOLD,
  };
}

/**
 * Gets or creates a system user for auto-generated moments
 */
export async function getSystemUserId(): Promise<string> {
  // Look for an existing system user
  const systemUser = await withRetry(() =>
    prisma.user.findFirst({
      where: {
        OR: [
          { email: 'system@samus.app' },
          { name: 'SAMUS System' },
        ],
      },
      select: { id: true },
    })
  );

  if (systemUser) {
    return systemUser.id;
  }

  // Create a system user if it doesn't exist
  const newSystemUser = await withRetry(() =>
    prisma.user.create({
      data: {
        email: 'system@samus.app',
        name: 'SAMUS System',
      },
      select: { id: true },
    })
  );

  console.log('[GenerateMoments] Created system user for auto-generated moments');
  return newSystemUser.id;
}

/**
 * Processes all completed matchups for notable events
 */
export async function processMatchupsForMoments(
  systemUserId: string
): Promise<{
  checked: number;
  blowouts: number;
  closeGames: number;
  results: MomentGenerationResult[];
}> {
  const results: MomentGenerationResult[] = [];
  let blowouts = 0;
  let closeGames = 0;

  try {
    // Find recently completed matchups (last 24 hours) that haven't had moments generated
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const matchups = await withRetry(() =>
      prisma.matchup.findMany({
        where: {
          isComplete: true,
          completedAt: { gte: recentCutoff },
          winnerId: { not: null },
          homeScore: { not: null },
          awayScore: { not: null },
        },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          winnerId: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 100, // Limit batch size
      })
    );

    console.log(`[GenerateMoments] Checking ${matchups.length} completed matchups for notable events`);

    for (const matchup of matchups) {
      // Get league settings
      const settings = await getLeagueSettings(matchup.leagueId);

      if (!settings.autoMomentsEnabled) {
        continue;
      }

      const homeScore = matchup.homeScore ?? 0;
      const awayScore = matchup.awayScore ?? 0;

      // Check for blowout
      const blowoutCheck = detectBlowoutGame(homeScore, awayScore, settings.blowoutThreshold);
      if (blowoutCheck.isBlowout) {
        const notableMatchup: NotableMatchup = {
          matchupId: matchup.id,
          leagueId: matchup.leagueId,
          weekNumber: matchup.weekNumber,
          homeTeamId: matchup.homeTeamId,
          awayTeamId: matchup.awayTeamId,
          homeTeamName: matchup.homeTeam?.name,
          awayTeamName: matchup.awayTeam?.name,
          homeScore,
          awayScore,
          winnerId: matchup.winnerId!,
          margin: blowoutCheck.margin,
          eventType: 'blowout_game',
        };

        const result = await createMatchupMoment(notableMatchup, systemUserId);
        results.push(result);
        if (result.success && result.momentId) {
          blowouts++;
        }
        continue; // Don't check for close game if it's a blowout
      }

      // Check for close game
      const closeCheck = detectCloseGame(homeScore, awayScore, settings.closeGameThreshold);
      if (closeCheck.isClose) {
        const notableMatchup: NotableMatchup = {
          matchupId: matchup.id,
          leagueId: matchup.leagueId,
          weekNumber: matchup.weekNumber,
          homeTeamId: matchup.homeTeamId,
          awayTeamId: matchup.awayTeamId,
          homeTeamName: matchup.homeTeam?.name,
          awayTeamName: matchup.awayTeam?.name,
          homeScore,
          awayScore,
          winnerId: matchup.winnerId!,
          margin: closeCheck.margin,
          eventType: 'close_game',
        };

        const result = await createMatchupMoment(notableMatchup, systemUserId);
        results.push(result);
        if (result.success && result.momentId) {
          closeGames++;
        }
      }
    }

    return { checked: matchups.length, blowouts, closeGames, results };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GenerateMoments] Error processing matchups:', errorMessage);
    return { checked: 0, blowouts: 0, closeGames: 0, results };
  }
}

/**
 * Processes notable transactions for moment generation
 */
export async function processTransactionsForMoments(
  systemUserId: string
): Promise<{
  checked: number;
  created: number;
  results: MomentGenerationResult[];
}> {
  const results: MomentGenerationResult[] = [];
  let created = 0;

  try {
    // Find recent notable transactions (last 24 hours)
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const transactions = await withRetry(() =>
      prisma.transaction.findMany({
        where: {
          OR: [
            { isNotable: true },
            { type: 'trade' },
            { faabAmount: { gte: 50 } },
          ],
          createdAt: { gte: recentCutoff },
        },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
          type: true,
          playerName: true,
          playerPosition: true,
          teamId: true,
          tradePartnerTeamId: true,
          faabAmount: true,
          isNotable: true,
          team: { select: { name: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 100, // Limit batch size
      })
    );

    console.log(`[GenerateMoments] Checking ${transactions.length} transactions for notable events`);

    for (const transaction of transactions) {
      // Get league settings
      const settings = await getLeagueSettings(transaction.leagueId);

      if (!settings.autoMomentsEnabled) {
        continue;
      }

      // Detect if transaction is notable
      const eventType = detectNotableTransaction(
        transaction.type,
        transaction.playerPosition,
        transaction.isNotable,
        transaction.faabAmount
      );

      if (!eventType) {
        continue;
      }

      // Get trade partner team name if applicable
      let tradePartnerTeamName: string | undefined;
      if (transaction.tradePartnerTeamId) {
        const tradePartner = await withRetry(() =>
          prisma.team.findUnique({
            where: { id: transaction.tradePartnerTeamId! },
            select: { name: true },
          })
        );
        tradePartnerTeamName = tradePartner?.name;
      }

      const notableTransaction: NotableTransaction = {
        transactionId: transaction.id,
        leagueId: transaction.leagueId,
        weekNumber: transaction.weekNumber,
        type: transaction.type,
        playerName: transaction.playerName,
        playerPosition: transaction.playerPosition ?? undefined,
        teamId: transaction.teamId,
        teamName: transaction.team?.name,
        tradePartnerTeamId: transaction.tradePartnerTeamId ?? undefined,
        tradePartnerTeamName,
        faabAmount: transaction.faabAmount ?? undefined,
        eventType,
      };

      const result = await createTransactionMoment(notableTransaction, systemUserId);
      results.push(result);
      if (result.success && result.momentId) {
        created++;
      }
    }

    return { checked: transactions.length, created, results };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GenerateMoments] Error processing transactions:', errorMessage);
    return { checked: 0, created: 0, results };
  }
}

// ============================================================================
// Integration Hooks
// ============================================================================

/**
 * Hook to run after matchup sync completes
 * Generates moments for any notable matchup results
 */
export async function onMatchupSyncComplete(leagueId: string, weekNumber: number): Promise<void> {
  console.log(`[GenerateMoments] Triggered for league ${leagueId} week ${weekNumber}`);

  try {
    const systemUserId = await getSystemUserId();
    const settings = await getLeagueSettings(leagueId);

    if (!settings.autoMomentsEnabled) {
      console.log(`[GenerateMoments] Auto-moments disabled for league ${leagueId}`);
      return;
    }

    // Find completed matchups for this league/week
    const matchups = await withRetry(() =>
      prisma.matchup.findMany({
        where: {
          leagueId,
          weekNumber,
          isComplete: true,
          winnerId: { not: null },
          homeScore: { not: null },
          awayScore: { not: null },
        },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          winnerId: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      })
    );

    for (const matchup of matchups) {
      const homeScore = matchup.homeScore ?? 0;
      const awayScore = matchup.awayScore ?? 0;

      // Check for blowout
      const blowoutCheck = detectBlowoutGame(homeScore, awayScore, settings.blowoutThreshold);
      if (blowoutCheck.isBlowout) {
        await createMatchupMoment(
          {
            matchupId: matchup.id,
            leagueId: matchup.leagueId,
            weekNumber: matchup.weekNumber,
            homeTeamId: matchup.homeTeamId,
            awayTeamId: matchup.awayTeamId,
            homeTeamName: matchup.homeTeam?.name,
            awayTeamName: matchup.awayTeam?.name,
            homeScore,
            awayScore,
            winnerId: matchup.winnerId!,
            margin: blowoutCheck.margin,
            eventType: 'blowout_game',
          },
          systemUserId
        );
        continue;
      }

      // Check for close game
      const closeCheck = detectCloseGame(homeScore, awayScore, settings.closeGameThreshold);
      if (closeCheck.isClose) {
        await createMatchupMoment(
          {
            matchupId: matchup.id,
            leagueId: matchup.leagueId,
            weekNumber: matchup.weekNumber,
            homeTeamId: matchup.homeTeamId,
            awayTeamId: matchup.awayTeamId,
            homeTeamName: matchup.homeTeam?.name,
            awayTeamName: matchup.awayTeam?.name,
            homeScore,
            awayScore,
            winnerId: matchup.winnerId!,
            margin: closeCheck.margin,
            eventType: 'close_game',
          },
          systemUserId
        );
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GenerateMoments] Error in onMatchupSyncComplete:`, errorMessage);
  }
}

/**
 * Hook to run after transaction sync completes
 * Generates moments for any notable transactions
 */
export async function onTransactionSyncComplete(
  leagueId: string,
  transactionIds: string[]
): Promise<void> {
  console.log(`[GenerateMoments] Processing ${transactionIds.length} transactions for league ${leagueId}`);

  try {
    const systemUserId = await getSystemUserId();
    const settings = await getLeagueSettings(leagueId);

    if (!settings.autoMomentsEnabled) {
      console.log(`[GenerateMoments] Auto-moments disabled for league ${leagueId}`);
      return;
    }

    // Fetch the transactions
    const transactions = await withRetry(() =>
      prisma.transaction.findMany({
        where: { id: { in: transactionIds } },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
          type: true,
          playerName: true,
          playerPosition: true,
          teamId: true,
          tradePartnerTeamId: true,
          faabAmount: true,
          isNotable: true,
          team: { select: { name: true } },
        },
      })
    );

    for (const transaction of transactions) {
      const eventType = detectNotableTransaction(
        transaction.type,
        transaction.playerPosition,
        transaction.isNotable,
        transaction.faabAmount
      );

      if (!eventType) {
        continue;
      }

      let tradePartnerTeamName: string | undefined;
      if (transaction.tradePartnerTeamId) {
        const tradePartner = await withRetry(() =>
          prisma.team.findUnique({
            where: { id: transaction.tradePartnerTeamId! },
            select: { name: true },
          })
        );
        tradePartnerTeamName = tradePartner?.name;
      }

      await createTransactionMoment(
        {
          transactionId: transaction.id,
          leagueId: transaction.leagueId,
          weekNumber: transaction.weekNumber,
          type: transaction.type,
          playerName: transaction.playerName,
          playerPosition: transaction.playerPosition ?? undefined,
          teamId: transaction.teamId,
          teamName: transaction.team?.name,
          tradePartnerTeamId: transaction.tradePartnerTeamId ?? undefined,
          tradePartnerTeamName,
          faabAmount: transaction.faabAmount ?? undefined,
          eventType,
        },
        systemUserId
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GenerateMoments] Error in onTransactionSyncComplete:`, errorMessage);
  }
}

// ============================================================================
// Main Job Functions
// ============================================================================

/**
 * Generates all pending auto-moments
 * This is the main entry point for the background job
 */
export async function generateAllPendingMoments(): Promise<GenerateMomentsResult> {
  const results: MomentGenerationResult[] = [];
  const errors: string[] = [];

  try {
    console.log('[GenerateMoments] Starting moment generation job...');

    const systemUserId = await getSystemUserId();

    // Process matchups for blowouts and close games
    const matchupResults = await processMatchupsForMoments(systemUserId);
    results.push(...matchupResults.results);

    // Process transactions for notable events
    const transactionResults = await processTransactionsForMoments(systemUserId);
    results.push(...transactionResults.results);

    // Collect errors from results
    for (const result of results) {
      if (!result.success && result.error && !result.error.includes('already exists')) {
        errors.push(`${result.momentType}: ${result.error}`);
      }
    }

    const momentsCreated = results.filter((r) => r.success && r.momentId).length;

    console.log(
      `[GenerateMoments] Job complete: ${momentsCreated} moments created ` +
        `(${matchupResults.blowouts} blowouts, ${matchupResults.closeGames} close games, ` +
        `${transactionResults.created} transactions)`
    );

    return {
      success: errors.length === 0,
      totalMatchupsChecked: matchupResults.checked,
      totalTransactionsChecked: transactionResults.checked,
      momentsCreated,
      blowoutMoments: matchupResults.blowouts,
      closeGameMoments: matchupResults.closeGames,
      transactionMoments: transactionResults.created,
      results,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GenerateMoments] Error in generateAllPendingMoments:', errorMessage);

    return {
      success: false,
      totalMatchupsChecked: 0,
      totalTransactionsChecked: 0,
      momentsCreated: 0,
      blowoutMoments: 0,
      closeGameMoments: 0,
      transactionMoments: 0,
      results,
      errors: [...errors, errorMessage],
    };
  }
}

/**
 * Run the full moment generation job
 * Entry point for scheduled/manual execution
 */
export async function runMomentGenerationJob(): Promise<GenerateMomentsResult> {
  console.log('[GenerateMoments] Starting moment generation job...');
  const startTime = Date.now();

  const result = await generateAllPendingMoments();

  const duration = Date.now() - startTime;
  console.log(`[GenerateMoments] Job completed in ${duration}ms`);
  console.log(
    `[GenerateMoments] Summary: ${result.totalMatchupsChecked} matchups checked, ` +
      `${result.totalTransactionsChecked} transactions checked, ` +
      `${result.momentsCreated} moments created`
  );

  if (result.errors.length > 0) {
    console.error('[GenerateMoments] Errors encountered:', result.errors);
  }

  return result;
}
