// Data layer for transactions
// Prisma database queries for league transaction history

import { prisma } from '@/lib/db';
import type { Transaction as PrismaTransaction, Team, TransactionType as PrismaTransactionType } from '@prisma/client';

import type {
  GetTransactionsInput,
  Transaction,
  TransactionsResponse,
  TransactionType,
  TransactionTeam,
  WaiverTransaction,
  FreeAgentTransaction,
  DropTransaction,
  TradeTransaction,
} from '@/types/transactions';

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

// Transform Prisma transaction to frontend Transaction type
function transformTransaction(
  dbTransaction: PrismaTransaction & { team: Team }
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
      // For trades, we'd need a more complex schema to track both teams
      // For now, represent as a single-team trade with notes
      const tradeTeam: TransactionTeam = {
        ...baseTeam,
        playersOut: [dbTransaction.playerName],
        playersIn: [],
      };

      // If there's a trade partner, create a second team entry
      const teams: TransactionTeam[] = [tradeTeam];
      if (dbTransaction.tradePartnerTeamId) {
        teams.push({
          id: dbTransaction.tradePartnerTeamId,
          name: 'Trade Partner', // We'd need to join to get actual name
          playersOut: [],
          playersIn: [dbTransaction.playerName],
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

  // Query transactions with team data
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

  // Check if there are more results
  const hasMore = transactions.length > limit;
  const paginatedTransactions = hasMore ? transactions.slice(0, limit) : transactions;

  // Transform to frontend types
  const transformedTransactions: Transaction[] = paginatedTransactions.map(transformTransaction);

  // Determine next cursor
  const nextCursor = hasMore
    ? paginatedTransactions[paginatedTransactions.length - 1]?.id || null
    : null;

  return {
    transactions: transformedTransactions,
    nextCursor,
  };
}
