// Types for Sleeper API integration

export interface SleeperLeague {
  league_id: string;
  name: string;
  total_rosters: number;
  season: string;
  avatar?: string;
  sport: string;
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
  settings?: SleeperLeagueSettings;
  scoring_settings?: Record<string, number>;
  roster_positions?: string[];
  // Previous season linking - used to chain API calls to get league history
  previous_league_id?: string | null;
  // Legacy fields for backward compatibility with mocks
  id?: string;
  team_count?: number;
}

export interface SleeperLeagueSettings {
  playoff_week_start?: number;
  playoff_teams?: number;
  num_teams?: number;
  type?: number; // 0 = redraft, 1 = keeper, 2 = dynasty
  waiver_type?: number;
  waiver_budget?: number;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  league_id: string;
  players?: string[];
  starters?: string[];
  reserve?: string[];
  taxi?: string[];
  settings?: {
    wins: number;
    losses: number;
    ties: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
  };
  metadata?: {
    streak?: string;
    record?: string;
  };
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

export interface SleeperLeagueUser {
  user_id: string;
  league_id: string;
  display_name: string;
  avatar?: string;
  is_owner?: boolean;
  is_bot?: boolean;
  metadata?: {
    team_name?: string;
    mention_pn?: string;
    allow_pn?: string;
  };
}

export interface SleeperMatchup {
  /** Roster ID that this matchup entry belongs to */
  roster_id: number;
  /** Matchup ID - teams with the same matchup_id are playing each other */
  matchup_id: number | null;
  /** Total points scored */
  points: number;
  /** Array of starter player IDs */
  starters?: string[];
  /** Points for each starter in order */
  starters_points?: number[];
  /** All player IDs on roster */
  players?: string[];
  /** Points per player (player_id: points) */
  players_points?: Record<string, number>;
  /** Custom points override (if any) */
  custom_points?: number | null;
}

/** Draft pick included in a trade transaction */
export interface SleeperDraftPick {
  /** Season the pick is for */
  season: string;
  /** Round number of the pick */
  round: number;
  /** Roster ID that now owns the pick */
  roster_id: number;
  /** Original owner roster ID */
  previous_owner_id: number;
  /** Original roster ID that had the pick */
  owner_id?: number;
}

/** Waiver budget transfer in a transaction */
export interface SleeperWaiverBudget {
  /** Roster ID sending the budget */
  sender: number;
  /** Roster ID receiving the budget */
  receiver: number;
  /** Amount of budget transferred */
  amount: number;
}

/** Transaction type from Sleeper API */
export type SleeperTransactionType = 'trade' | 'waiver' | 'free_agent' | 'commissioner';

/** Transaction status from Sleeper API */
export type SleeperTransactionStatus = 'complete' | 'pending' | 'failed';

/** Transaction from Sleeper API */
export interface SleeperTransaction {
  /** Unique transaction identifier */
  transaction_id: string;
  /** Type of transaction */
  type: SleeperTransactionType;
  /** Status of the transaction */
  status: SleeperTransactionStatus;
  /** Roster IDs involved in the transaction */
  roster_ids: number[];
  /** Players added (player_id -> roster_id that receives) */
  adds: Record<string, number> | null;
  /** Players dropped (player_id -> roster_id that drops) */
  drops: Record<string, number> | null;
  /** Draft picks included in trade */
  draft_picks?: SleeperDraftPick[];
  /** Waiver budget transfers */
  waiver_budget?: SleeperWaiverBudget[];
  /** Unix timestamp in milliseconds when transaction was created */
  created: number;
  /** User ID of the transaction creator */
  creator?: string;
  /** User IDs that consented to the transaction */
  consenter_ids?: number[];
  /** Week number (leg) when the transaction occurred */
  leg?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown> | null;
  /** Transaction settings */
  settings?: Record<string, unknown> | null;
  /** League ID for the transaction */
  league_id?: string;
  /** Status timestamp (when status last changed) */
  status_updated?: number;
}

export interface LookupLeaguesResponse {
  leagues: SleeperLeague[];
}

export interface LookupLeaguesError {
  error: string;
  code: 'NOT_FOUND' | 'TIMEOUT' | 'INVALID_USERNAME' | 'UNKNOWN';
}

/** Player from Sleeper API player database */
export interface SleeperPlayer {
  /** Unique player identifier */
  player_id: string;
  /** Full player name */
  full_name: string;
  /** First name */
  first_name?: string;
  /** Last name */
  last_name?: string;
  /** Current NFL team abbreviation (null if free agent) */
  team: string | null;
  /** Primary position (QB, RB, WR, TE, K, DEF) */
  position: string;
  /** Player status (Active, Inactive, Injured Reserve, etc.) */
  status: string;
  /** Player age */
  age?: number;
  /** Years of NFL experience */
  years_exp?: number;
  /** College attended */
  college?: string;
  /** Height (e.g., "6'3") */
  height?: string;
  /** Weight in pounds */
  weight?: string;
  /** Jersey number */
  number?: number;
  /** Birth date (YYYY-MM-DD format) */
  birth_date?: string;
  /** Current injury status (null, Questionable, Doubtful, Out, IR, etc.) */
  injury_status?: string | null;
  /** Fantasy positions the player is eligible for */
  fantasy_positions?: string[];
  /** Depth chart position */
  depth_chart_position?: number;
  /** Order in depth chart */
  depth_chart_order?: number;
  /** Sport (nfl, nba, etc.) */
  sport?: string;
  /** Search ranking for player lookup */
  search_rank?: number;
  /** Full search name for matching */
  search_full_name?: string;
  /** First name for search */
  search_first_name?: string;
  /** Last name for search */
  search_last_name?: string;
  /** Player news updates */
  news_updated?: number;
  /** Whether player is active in fantasy */
  active?: boolean;
  /** Hashtag/handle */
  hashtag?: string;
  /** ESPN ID for cross-platform mapping */
  espn_id?: number;
  /** Yahoo ID for cross-platform mapping */
  yahoo_id?: number;
  /** Rotowire ID for cross-platform mapping */
  rotowire_id?: number;
  /** Fantasy Data ID */
  fantasy_data_id?: number;
  /** Sportradar ID */
  sportradar_id?: string;
  /** GSIS ID (NFL official) */
  gsis_id?: string;
  /** Stats ID */
  stats_id?: number;
  /** Injury notes */
  injury_notes?: string | null;
  /** Injury body part */
  injury_body_part?: string | null;
  /** Practice participation status */
  practice_participation?: string | null;
  /** Practice description */
  practice_description?: string | null;
  /** Additional metadata */
  metadata?: Record<string, unknown> | null;
}

/** Player database response from Sleeper API */
export type SleeperPlayersResponse = Record<string, SleeperPlayer>;

/** Season type from Sleeper NFL State */
export type SleeperSeasonType = 'pre' | 'regular' | 'post' | 'off';

/**
 * NFL State from Sleeper API
 * Contains current week, season, and playoff information
 */
export interface SleeperNFLState {
  /** Current week number (0 during offseason) */
  week: number;
  /** Current season year (e.g., "2025") */
  season: string;
  /** Season phase: pre (preseason), regular, post (postseason), off (offseason) */
  season_type: SleeperSeasonType;
  /** Display week for UI purposes */
  display_week: number;
  /** Leg number (typically matches week) */
  leg: number;
  /** Season start date (YYYY-MM-DD format) */
  season_start_date?: string;
  /** Previous season year */
  previous_season?: string;
  /** Season for league creation (same as season in most cases) */
  league_season?: string;
  /** Season when leagues can be created */
  league_create_season?: string;
}
