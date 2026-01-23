// Data layer for transactions
// Prisma database queries for league transaction history

import { prisma } from '@/lib/db';

import type {
  DropTransaction,
  FreeAgentTransaction,
  GetTransactionsInput,
  TradeTransaction,
  Transaction,
  TransactionsResponse,
  TransactionTeam,
  TransactionType,
  WaiverTransaction,
} from '@/types/transactions';
import type { Transaction as PrismaTransaction, TransactionType as PrismaTransactionType, Team } from '@prisma/client';

const DEFAULT_LIMIT = 10;

// Map frontend transaction type to Prisma enum
function mapTypeToPrismaType(type: TransactionType): PrismaTransactionType {
  switch (type) {
    case 'trade':
      return 'trade';
    case 'waiver':
      return 'waiver';
    case 'free_agent':
      return 'add'; // free_agent maps to 'add' in Prisma
    case 'drop':
      return 'drop';
    default:
      return type;
  }
}

// Map Prisma transaction type to frontend type
function mapPrismaTypeToFrontend(type: PrismaTransactionType): TransactionType {
  switch (type) {
    case 'trade':
      return 'trade';
    case 'waiver':
      return 'waiver';
    case 'add':
      return 'free_agent';
    case 'drop':
      return 'drop';
    default:
      return type as TransactionType;
  }
}

// Types for parsed trade details from notes field
interface ParsedTradeTeam {
  rosterId: number;
  teamId: string;
  teamName: string;
  playersIn: string[];
  playersOut: string[];
  draftPicksIn: string[];
  draftPicksOut: string[];
  faabIn: number;
  faabOut: number;
}

interface ParsedTradeDetails {
  teams: ParsedTradeTeam[];
}

interface ParsedNotes {
  transactionId?: string;
  adds?: Record<string, number>;
  drops?: Record<string, number>;
  tradeDetails?: ParsedTradeDetails;
}

// Build assets list for a team (what they traded away)
function buildAssetsOut(team: ParsedTradeTeam): string[] {
  const assets: string[] = [];

  // Add players traded away
  assets.push(...team.playersOut);

  // Add draft picks traded away
  assets.push(...team.draftPicksOut);

  // Add FAAB traded away
  if (team.faabOut > 0) {
    assets.push(`$${team.faabOut} FAAB`);
  }

  return assets;
}

// Build assets list for a team (what they received)
function buildAssetsIn(team: ParsedTradeTeam): string[] {
  const assets: string[] = [];

  // Add players received
  assets.push(...team.playersIn);

  // Add draft picks received
  assets.push(...team.draftPicksIn);

  // Add FAAB received
  if (team.faabIn > 0) {
    assets.push(`$${team.faabIn} FAAB`);
  }

  return assets;
}

// Transform Prisma transaction to frontend Transaction type
function transformTransaction(
  dbTransaction: PrismaTransaction & { team: Team; tradePartnerTeam?: Team | null }
): Transaction {
  const frontendType = mapPrismaTypeToFrontend(dbTransaction.type);
  const baseTeam: TransactionTeam = {
    id: dbTransaction.team.id,
    name: dbTransaction.team.name,
    avatarUrl: dbTransaction.team.avatarUrl || undefined,
  };

  const timestamp = dbTransaction.timestamp.toISOString();

  switch (frontendType) {
    case 'trade': {
      // Try to parse trade details from notes field
      let parsedNotes: ParsedNotes | null = null;
      if (dbTransaction.notes) {
        try {
          parsedNotes = JSON.parse(dbTransaction.notes) as ParsedNotes;
        } catch {
          // Notes parsing failed, fall back to basic display
        }
      }

      // If we have detailed trade info, use it
      if (parsedNotes?.tradeDetails?.teams && parsedNotes.tradeDetails.teams.length >= 2) {
        const teams: TransactionTeam[] = parsedNotes.tradeDetails.teams.map((teamDetail) => ({
          id: teamDetail.teamId,
          name: teamDetail.teamName,
          avatarUrl: undefined, // Could be enhanced later
          playersOut: buildAssetsOut(teamDetail),
          playersIn: buildAssetsIn(teamDetail),
        }));

        return {
          id: dbTransaction.id,
          type: 'trade',
          timestamp,
          teams,
          status: 'completed',
        } satisfies TradeTransaction;
      }

      // Fall back to basic trade display if no detailed info
      const tradeTeam: TransactionTeam = {
        ...baseTeam,
        playersOut: dbTransaction.playerName !== 'Trade' ? [dbTransaction.playerName] : [],
        playersIn: [],
      };

      // If there's a trade partner, create a second team entry
      const teams: TransactionTeam[] = [tradeTeam];
      if (dbTransaction.tradePartnerTeamId && dbTransaction.tradePartnerTeam) {
        teams.push({
          id: dbTransaction.tradePartnerTeam.id,
          name: dbTransaction.tradePartnerTeam.name,
          avatarUrl: dbTransaction.tradePartnerTeam.avatarUrl || undefined,
          playersOut: [],
          playersIn: dbTransaction.playerName !== 'Trade' ? [dbTransaction.playerName] : [],
        });
      } else if (dbTransaction.tradePartnerTeamId) {
        // We have a partner ID but no joined team data
        teams.push({
          id: dbTransaction.tradePartnerTeamId,
          name: 'Trade Partner',
          playersOut: [],
          playersIn: dbTransaction.playerName !== 'Trade' ? [dbTransaction.playerName] : [],
        });
      }

      return {
        id: dbTransaction.id,
        type: 'trade',
        timestamp,
        teams,
        status: 'completed',
      } satisfies TradeTransaction;
    }

    case 'waiver': {
      return {
        id: dbTransaction.id,
        type: 'waiver',
        timestamp,
        team: baseTeam,
        playerAdded: dbTransaction.playerName,
        faabAmount: dbTransaction.faabAmount || undefined,
      } satisfies WaiverTransaction;
    }

    case 'free_agent': {
      return {
        id: dbTransaction.id,
        type: 'free_agent',
        timestamp,
        team: baseTeam,
        playerAdded: dbTransaction.playerName,
      } satisfies FreeAgentTransaction;
    }

    case 'drop': {
      return {
        id: dbTransaction.id,
        type: 'drop',
        timestamp,
        team: baseTeam,
        playerDropped: dbTransaction.playerName,
      } satisfies DropTransaction;
    }

    default:
      // Fallback for unknown types - treat as free_agent
      return {
        id: dbTransaction.id,
        type: 'free_agent',
        timestamp,
        team: baseTeam,
        playerAdded: dbTransaction.playerName,
      } satisfies FreeAgentTransaction;
  }
}

export async function getTransactions(input: GetTransactionsInput): Promise<TransactionsResponse> {
  const { leagueSlug, cursor, limit = DEFAULT_LIMIT, type, teamId, playerSearch } = input;

  // Build where clause
  const whereClause: {
    league?: { slug: string };
    type?: PrismaTransactionType;
    teamId?: string;
    playerName?: { contains: string; mode: 'insensitive' };
  } = {};

  // Filter by league slug
  if (leagueSlug) {
    whereClause.league = { slug: leagueSlug };
  }

  // Filter by transaction type if specified
  if (type) {
    whereClause.type = mapTypeToPrismaType(type);
  }

  // Filter by team if specified
  if (teamId) {
    whereClause.teamId = teamId;
  }

  // Filter by player name search (case-insensitive)
  if (playerSearch) {
    whereClause.playerName = {
      contains: playerSearch,
      mode: 'insensitive',
    };
  }

  // Build cursor for pagination
  const cursorClause = cursor ? { id: cursor } : undefined;

  // Query transactions with team data (and trade partner for trades)
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      team: true,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: limit + 1, // Take one extra to check if there's a next page
    skip: cursor ? 1 : 0, // Skip the cursor itself when paginating
    cursor: cursorClause,
  });

  // For trades, fetch trade partner teams in a separate query
  const tradePartnerIds = transactions
    .filter((t) => t.type === 'trade' && t.tradePartnerTeamId)
    .map((t) => t.tradePartnerTeamId as string);

  let tradePartnerTeams: Map<string, Team> = new Map();
  if (tradePartnerIds.length > 0) {
    const partners = await prisma.team.findMany({
      where: { id: { in: tradePartnerIds } },
    });
    tradePartnerTeams = new Map(partners.map((p) => [p.id, p]));
  }

  // Attach trade partner teams to transactions
  const transactionsWithPartners = transactions.map((t) => ({
    ...t,
    tradePartnerTeam: t.tradePartnerTeamId ? tradePartnerTeams.get(t.tradePartnerTeamId) || null : null,
  }));

  // Check if there are more results
  const hasMore = transactionsWithPartners.length > limit;
  const paginatedTransactions = hasMore ? transactionsWithPartners.slice(0, limit) : transactionsWithPartners;

  // Transform to frontend types
  const transformedTransactions: Transaction[] = paginatedTransactions.map(transformTransaction);

  // Determine next cursor
  const nextCursor = hasMore ? paginatedTransactions[paginatedTransactions.length - 1]?.id || null : null;

  return {
    transactions: transformedTransactions,
    nextCursor,
  };
}
