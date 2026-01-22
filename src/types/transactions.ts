// Transaction types for the transactions page feature

export type TransactionType = 'trade' | 'waiver' | 'free_agent' | 'drop';

export interface Player {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
}

export interface TransactionTeam {
  id: string;
  name: string;
  avatarUrl?: string;
  playersOut?: string[];
  playersIn?: string[];
}

export interface TradeTransaction {
  id: string;
  type: 'trade';
  timestamp: string;
  teams: TransactionTeam[];
  status?: 'completed' | 'pending' | 'vetoed';
}

export interface WaiverTransaction {
  id: string;
  type: 'waiver';
  timestamp: string;
  team: TransactionTeam;
  playerAdded: string;
  playerAddedDetails?: Player;
  playerDropped?: string;
  playerDroppedDetails?: Player;
  faabAmount?: number;
  waiverPriority?: number;
}

export interface FreeAgentTransaction {
  id: string;
  type: 'free_agent';
  timestamp: string;
  team: TransactionTeam;
  playerAdded?: string;
  playerAddedDetails?: Player;
  playerDropped?: string;
  playerDroppedDetails?: Player;
}

export interface DropTransaction {
  id: string;
  type: 'drop';
  timestamp: string;
  team: TransactionTeam;
  playerDropped: string;
  playerDroppedDetails?: Player;
}

export type Transaction = TradeTransaction | WaiverTransaction | FreeAgentTransaction | DropTransaction;

export interface TransactionsResponse {
  transactions: Transaction[];
  nextCursor?: string | null;
}

export interface GetTransactionsInput {
  leagueSlug: string;
  cursor?: string;
  limit?: number;
  type?: TransactionType;
  teamId?: string;
  playerSearch?: string;
}
