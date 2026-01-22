/**
 * Transaction Promotion Job (task-54)
 *
 * Background job to promote high-impact transactions to featured moments.
 * - Analyzes transaction impact (playoff implications, rivalry trades)
 * - Calculates impact scores based on multiple factors
 * - Promotes high-impact transactions to moments with hype text
 * - Posts to league feed with transaction metadata
 *
 * Dependencies: task-53 (Automated Moment Generation Job)
 */

import { prisma, withRetry } from '@/lib/db';
import { getSystemUserId, transactionMomentExists } from './generate-moments';

// ============================================================================
// Types
// ============================================================================

export interface TransactionPromotionResult {
  success: boolean;
  momentId?: string;
  transactionId: string;
  leagueId: string;
  error?: string;
}

export interface PromoteTransactionsResult {
  success: boolean;
  totalTransactionsChecked: number;
  transactionsPromoted: number;
  results: TransactionPromotionResult[];
  errors: string[];
}

export interface ImpactFactors {
  playerValue: number; // 1-10 star rating based on position
  weekNumber: number; // Later = more impactful (playoffs)
  isPlayoffContender: boolean;
  isRivalryTrade: boolean;
  transactionType: string;
  faabAmount?: number;
}

export interface PromotableTransaction {
  id: string;
  leagueId: string;
  weekNumber: number;
  type: string;
  teamId: string;
  teamName?: string;
  playerName: string;
  playerPosition?: string;
  tradePartnerTeamId?: string;
  tradePartnerTeamName?: string;
  faabAmount?: number;
  impactScore: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Minimum impact score required for promotion (0-10) */
const IMPACT_THRESHOLD = 7.0;

/** Week number when playoff implications start (typically week 11) */
const PLAYOFF_WEEK_START = 11;

/** Position values for impact calculation */
const POSITION_VALUES: Record<string, number> = {
  QB: 9,
  RB: 8,
  WR: 7,
  TE: 6,
  K: 3,
  DEF: 4,
  D: 4,
  DL: 4,
  LB: 4,
  DB: 4,
};

/** Default position value for unknown positions */
const DEFAULT_POSITION_VALUE = 5;

// ============================================================================
// Impact Score Calculation
// ============================================================================

/**
 * Calculates the impact score for a transaction based on multiple factors
 * Returns a score between 0 and 10
 */
export function calculateImpactScore(factors: ImpactFactors): number {
  let score = factors.playerValue;

  // Late-season multiplier (weeks 11-17 are playoff push)
  if (factors.weekNumber >= PLAYOFF_WEEK_START) {
    score *= 1.5;
  }

  // Playoff contender bonus
  if (factors.isPlayoffContender) {
    score *= 1.3;
  }

  // Rivalry trade bonus
  if (factors.isRivalryTrade) {
    score *= 1.2;
  }

  // Transaction type multiplier: Trade > Waiver > Add > Drop
  switch (factors.transactionType) {
    case 'trade':
      score *= 1.2;
      break;
    case 'waiver':
      score *= 1.1;
      break;
    case 'add':
      score *= 1.0;
      break;
    case 'drop':
      score *= 0.8;
      break;
  }

  // FAAB bonus for significant spending (>50% of typical budget)
  if (factors.faabAmount && factors.faabAmount >= 50) {
    score *= 1.15;
  }

  // Cap at 10
  return Math.min(score, 10);
}

/**
 * Gets the player value based on position
 */
export function getPositionValue(position: string | null | undefined): number {
  if (!position) return DEFAULT_POSITION_VALUE;
  return POSITION_VALUES[position.toUpperCase()] ?? DEFAULT_POSITION_VALUE;
}

// ============================================================================
// Hype Text Generation
// ============================================================================

/**
 * Generates hype text for a blockbuster trade
 */
export function generateTradeHypeText(
  playerName: string,
  fromTeam: string,
  toTeam: string,
  weekNumber: number,
  isPlayoffImpact: boolean,
  isRivalryTrade: boolean
): string {
  const baseEmoji = '💰';
  let prefix = 'BLOCKBUSTER TRADE!';
  let suffix = '';

  if (isPlayoffImpact) {
    prefix = '🔥 PLAYOFF-SHAKING TRADE!';
    suffix = ' This could change the playoff picture!';
  }

  if (isRivalryTrade) {
    prefix = '⚔️ RIVALRY TRADE ALERT!';
    suffix = ' Trading with the enemy!';
  }

  if (weekNumber >= 13) {
    prefix = '🏆 CHAMPIONSHIP PUSH TRADE!';
    suffix = ' Going all in for the title!';
  }

  return `${baseEmoji} ${prefix} ${playerName} moves from ${fromTeam} to ${toTeam}!${suffix}`;
}

/**
 * Generates hype text for a waiver wire pickup
 */
export function generateWaiverHypeText(
  playerName: string,
  teamName: string,
  faabAmount?: number,
  weekNumber?: number
): string {
  if (faabAmount && faabAmount >= 75) {
    return `🚨 ALL-IN WAIVER! ${teamName} drops a whopping $${faabAmount} FAAB on ${playerName}! Desperation or genius? 🤯`;
  }

  if (faabAmount && faabAmount >= 50) {
    return `📈 WAIVER WIRE STEAL! ${teamName} scoops up ${playerName} for $${faabAmount} FAAB! 👀`;
  }

  if (weekNumber && weekNumber >= PLAYOFF_WEEK_START) {
    return `🎯 PLAYOFF PICKUP! ${teamName} adds ${playerName} for the stretch run! 💪`;
  }

  return `📈 WAIVER WIRE WIN! ${teamName} picks up ${playerName}!`;
}

/**
 * Generates hype text for a drop
 */
export function generateDropHypeText(playerName: string, teamName: string): string {
  return `😱 SHOCKING DROP! ${teamName} cuts ties with ${playerName}!`;
}

/**
 * Generates hype text based on transaction type and context
 */
export function generateHypeText(
  type: string,
  playerName: string,
  team1: string,
  team2?: string,
  weekNumber?: number,
  isPlayoffImpact?: boolean,
  isRivalryTrade?: boolean,
  faabAmount?: number
): string {
  switch (type) {
    case 'trade':
      return generateTradeHypeText(
        playerName,
        team1,
        team2 || 'Unknown Team',
        weekNumber || 1,
        isPlayoffImpact || false,
        isRivalryTrade || false
      );
    case 'waiver':
    case 'add':
      return generateWaiverHypeText(playerName, team1, faabAmount, weekNumber);
    case 'drop':
      return generateDropHypeText(playerName, team1);
    default:
      return `📢 Transaction alert: ${playerName}`;
  }
}

// ============================================================================
// Playoff and Rivalry Detection
// ============================================================================

/**
 * Checks if a team is a playoff contender based on standings
 */
export async function isPlayoffContender(leagueId: string, teamId: string): Promise<boolean> {
  try {
    // Get league size and team standings
    const league = await withRetry(() =>
      prisma.league.findUnique({
        where: { id: leagueId },
        select: {
          teamCount: true,
        },
      })
    );

    if (!league) return false;

    // Get teams ordered by wins and points scored
    const teams = await withRetry(() =>
      prisma.team.findMany({
        where: { leagueId },
        orderBy: [{ wins: 'desc' }, { pointsScored: 'desc' }],
        select: { id: true },
      })
    );

    // Assume ~50% of teams make playoffs (common in fantasy)
    const playoffSpots = Math.ceil(league.teamCount / 2);
    const teamIndex = teams.findIndex((t) => t.id === teamId);

    // Team is a contender if they're in playoff position or within 2 spots
    return teamIndex !== -1 && teamIndex < playoffSpots + 2;
  } catch {
    // Default to false if we can't determine
    return false;
  }
}

/**
 * Checks if two teams have a rivalry (based on historical matchups or user-defined)
 */
export async function isRivalryTrade(leagueId: string, teamId: string, tradePartnerTeamId: string): Promise<boolean> {
  try {
    // Check for head-to-head matchup history (more than 3 matchups indicates frequent opponents)
    const matchupCount = await withRetry(() =>
      prisma.matchup.count({
        where: {
          leagueId,
          OR: [
            { homeTeamId: teamId, awayTeamId: tradePartnerTeamId },
            { homeTeamId: tradePartnerTeamId, awayTeamId: teamId },
          ],
        },
      })
    );

    // Consider it a rivalry if they've played 4+ times
    return matchupCount >= 4;
  } catch {
    return false;
  }
}

// ============================================================================
// Moment Creation
// ============================================================================

/**
 * Creates a promoted moment for a high-impact transaction
 */
export async function createPromotedMoment(
  transaction: PromotableTransaction,
  systemUserId: string,
  isPlayoffImpact: boolean,
  isRivalry: boolean
): Promise<TransactionPromotionResult> {
  try {
    // Check for duplicate (using task-53's deduplication)
    const exists = await transactionMomentExists(transaction.leagueId, transaction.id, 'transaction_promotion');
    if (exists) {
      return {
        success: true,
        transactionId: transaction.id,
        leagueId: transaction.leagueId,
        error: 'Moment already exists for this transaction',
      };
    }

    // Generate hype text
    const content = generateHypeText(
      transaction.type,
      transaction.playerName,
      transaction.teamName || 'Unknown Team',
      transaction.tradePartnerTeamName,
      transaction.weekNumber,
      isPlayoffImpact,
      isRivalry,
      transaction.faabAmount
    );

    // Create the moment
    const moment = await withRetry(() =>
      prisma.moment.create({
        data: {
          leagueId: transaction.leagueId,
          authorId: systemUserId,
          type: 'transaction',
          content,
          isAutoGenerated: true,
          momentType: 'transaction_promotion',
          sourceTransactionId: transaction.id,
          metadata: {
            transactionId: transaction.id,
            transactionType: transaction.type,
            playerName: transaction.playerName,
            playerPosition: transaction.playerPosition,
            fromTeamId: transaction.teamId,
            toTeamId: transaction.tradePartnerTeamId,
            weekNumber: transaction.weekNumber,
            impactScore: transaction.impactScore,
            isPlayoffImpact,
            isRivalryTrade: isRivalry,
            faabAmount: transaction.faabAmount,
          },
          isPinned: false,
          isHidden: false,
          lastActivityAt: new Date(),
        },
        select: { id: true },
      })
    );

    // Mark transaction as promoted
    await withRetry(() =>
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          isPromoted: true,
          promotedMomentId: moment.id,
        },
      })
    );

    console.log(
      `[PromoteTransactions] Promoted transaction ${transaction.id} ` +
        `(${transaction.playerName}, score: ${transaction.impactScore.toFixed(1)})`
    );

    return {
      success: true,
      momentId: moment.id,
      transactionId: transaction.id,
      leagueId: transaction.leagueId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PromoteTransactions] Error promoting transaction ${transaction.id}:`, errorMessage);

    return {
      success: false,
      transactionId: transaction.id,
      leagueId: transaction.leagueId,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Main Job Functions
// ============================================================================

/**
 * Processes transactions and calculates impact scores
 */
export async function processTransactionsForPromotion(systemUserId: string): Promise<{
  checked: number;
  promoted: number;
  results: TransactionPromotionResult[];
}> {
  const results: TransactionPromotionResult[] = [];
  let promoted = 0;

  try {
    // Find recent unpromoted transactions (last 48 hours)
    const recentCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const transactions = await withRetry(() =>
      prisma.transaction.findMany({
        where: {
          createdAt: { gte: recentCutoff },
          isPromoted: false,
          // Include trades and significant waiver moves
          OR: [{ type: 'trade' }, { faabAmount: { gte: 30 } }, { isNotable: true }],
        },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
          type: true,
          teamId: true,
          playerName: true,
          playerPosition: true,
          tradePartnerTeamId: true,
          faabAmount: true,
          impactScore: true,
          team: { select: { name: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 100, // Limit batch size
      })
    );

    console.log(`[PromoteTransactions] Checking ${transactions.length} transactions for promotion`);

    for (const tx of transactions) {
      // Check playoff contender status
      const isContender = await isPlayoffContender(tx.leagueId, tx.teamId);

      // Check rivalry status for trades
      let isRivalry = false;
      let tradePartnerTeamName: string | undefined;

      if (tx.tradePartnerTeamId) {
        const partnerId = tx.tradePartnerTeamId;
        isRivalry = await isRivalryTrade(tx.leagueId, tx.teamId, partnerId);

        const tradePartner = await withRetry(() =>
          prisma.team.findUnique({
            where: { id: partnerId },
            select: { name: true },
          })
        );
        tradePartnerTeamName = tradePartner?.name;
      }

      // Calculate impact score if not already calculated
      let impactScore = tx.impactScore;
      if (impactScore === null) {
        const factors: ImpactFactors = {
          playerValue: getPositionValue(tx.playerPosition),
          weekNumber: tx.weekNumber,
          isPlayoffContender: isContender,
          isRivalryTrade: isRivalry,
          transactionType: tx.type,
          faabAmount: tx.faabAmount ?? undefined,
        };

        impactScore = calculateImpactScore(factors);

        // Store calculated impact score
        await withRetry(() =>
          prisma.transaction.update({
            where: { id: tx.id },
            data: { impactScore },
          })
        );
      }

      // Check if transaction meets promotion threshold
      if (impactScore < IMPACT_THRESHOLD) {
        continue;
      }

      const promotable: PromotableTransaction = {
        id: tx.id,
        leagueId: tx.leagueId,
        weekNumber: tx.weekNumber,
        type: tx.type,
        teamId: tx.teamId,
        teamName: tx.team?.name,
        playerName: tx.playerName,
        playerPosition: tx.playerPosition ?? undefined,
        tradePartnerTeamId: tx.tradePartnerTeamId ?? undefined,
        tradePartnerTeamName,
        faabAmount: tx.faabAmount ?? undefined,
        impactScore,
      };

      const result = await createPromotedMoment(
        promotable,
        systemUserId,
        tx.weekNumber >= PLAYOFF_WEEK_START && isContender,
        isRivalry
      );

      results.push(result);
      if (result.success && result.momentId) {
        promoted++;
      }
    }

    return { checked: transactions.length, promoted, results };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PromoteTransactions] Error processing transactions:', errorMessage);
    return { checked: 0, promoted: 0, results };
  }
}

/**
 * Promotes all eligible high-impact transactions
 * Main entry point for the background job
 */
export async function promoteHighImpactTransactions(): Promise<PromoteTransactionsResult> {
  const results: TransactionPromotionResult[] = [];
  const errors: string[] = [];

  try {
    console.log('[PromoteTransactions] Starting transaction promotion job...');

    const systemUserId = await getSystemUserId();

    const processResults = await processTransactionsForPromotion(systemUserId);
    results.push(...processResults.results);

    // Collect errors from results
    for (const result of results) {
      if (!result.success && result.error && !result.error.includes('already exists')) {
        errors.push(`Transaction ${result.transactionId}: ${result.error}`);
      }
    }

    console.log(
      `[PromoteTransactions] Job complete: ${processResults.promoted} transactions promoted ` +
        `out of ${processResults.checked} checked`
    );

    return {
      success: errors.length === 0,
      totalTransactionsChecked: processResults.checked,
      transactionsPromoted: processResults.promoted,
      results,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PromoteTransactions] Error in promoteHighImpactTransactions:', errorMessage);

    return {
      success: false,
      totalTransactionsChecked: 0,
      transactionsPromoted: 0,
      results,
      errors: [...errors, errorMessage],
    };
  }
}

/**
 * Run the transaction promotion job
 * Entry point for scheduled/manual execution
 */
export async function runTransactionPromotionJob(): Promise<PromoteTransactionsResult> {
  console.log('[PromoteTransactions] Starting transaction promotion job...');
  const startTime = Date.now();

  const result = await promoteHighImpactTransactions();

  const duration = Date.now() - startTime;
  console.log(`[PromoteTransactions] Job completed in ${duration}ms`);
  console.log(
    `[PromoteTransactions] Summary: ${result.totalTransactionsChecked} checked, ` +
      `${result.transactionsPromoted} promoted`
  );

  if (result.errors.length > 0) {
    console.error('[PromoteTransactions] Errors encountered:', result.errors);
  }

  return result;
}

// ============================================================================
// Integration Hooks
// ============================================================================

/**
 * Hook to run after a transaction is created/synced
 * Evaluates the transaction for immediate promotion
 */
export async function onTransactionCreated(transactionId: string): Promise<void> {
  console.log(`[PromoteTransactions] Evaluating transaction ${transactionId} for promotion`);

  try {
    const systemUserId = await getSystemUserId();

    const tx = await withRetry(() =>
      prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          leagueId: true,
          weekNumber: true,
          type: true,
          teamId: true,
          playerName: true,
          playerPosition: true,
          tradePartnerTeamId: true,
          faabAmount: true,
          isPromoted: true,
          team: { select: { name: true } },
        },
      })
    );

    if (!tx || tx.isPromoted) {
      return;
    }

    // Check playoff contender status
    const isContender = await isPlayoffContender(tx.leagueId, tx.teamId);

    // Check rivalry status for trades
    let isRivalry = false;
    let tradePartnerTeamName: string | undefined;

    if (tx.tradePartnerTeamId) {
      const partnerId = tx.tradePartnerTeamId;
      isRivalry = await isRivalryTrade(tx.leagueId, tx.teamId, partnerId);

      const tradePartner = await withRetry(() =>
        prisma.team.findUnique({
          where: { id: partnerId },
          select: { name: true },
        })
      );
      tradePartnerTeamName = tradePartner?.name;
    }

    // Calculate impact score
    const factors: ImpactFactors = {
      playerValue: getPositionValue(tx.playerPosition),
      weekNumber: tx.weekNumber,
      isPlayoffContender: isContender,
      isRivalryTrade: isRivalry,
      transactionType: tx.type,
      faabAmount: tx.faabAmount ?? undefined,
    };

    const impactScore = calculateImpactScore(factors);

    // Store impact score
    await withRetry(() =>
      prisma.transaction.update({
        where: { id: tx.id },
        data: { impactScore },
      })
    );

    // Check if it meets promotion threshold
    if (impactScore < IMPACT_THRESHOLD) {
      console.log(
        `[PromoteTransactions] Transaction ${transactionId} ` +
          `(score: ${impactScore.toFixed(1)}) below threshold, skipping`
      );
      return;
    }

    const promotable: PromotableTransaction = {
      id: tx.id,
      leagueId: tx.leagueId,
      weekNumber: tx.weekNumber,
      type: tx.type,
      teamId: tx.teamId,
      teamName: tx.team?.name,
      playerName: tx.playerName,
      playerPosition: tx.playerPosition ?? undefined,
      tradePartnerTeamId: tx.tradePartnerTeamId ?? undefined,
      tradePartnerTeamName,
      faabAmount: tx.faabAmount ?? undefined,
      impactScore,
    };

    await createPromotedMoment(promotable, systemUserId, tx.weekNumber >= PLAYOFF_WEEK_START && isContender, isRivalry);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PromoteTransactions] Error in onTransactionCreated:`, errorMessage);
  }
}
