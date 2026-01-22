/**
 * Sleeper Integration Module
 *
 * Provides functions to interact with the Sleeper Fantasy Football API.
 * All functions include rate limiting, caching, and error handling.
 */

// League fetching
export {
  fetchSleeperLeague,
  fetchSleeperLeagueWithResult,
  invalidateLeagueCache,
  clearLeagueCache,
  getCacheStats,
  SLEEPER_API_BASE,
  CACHE_TTL_MS,
  MAX_RETRIES,
} from './fetch-league';

export type { FetchSleeperLeagueResult } from './fetch-league';

// User lookup fetching
export {
  fetchSleeperUser,
  fetchSleeperUserWithResult,
  invalidateUserCache,
  clearUserCache,
  getUserCacheStats,
  validateSleeperUsername,
  normalizeUsername,
  fetchUserLeagueIds,
  getUserEndpoint,
  USER_CACHE_TTL_MS,
} from './fetch-user';

export type { FetchSleeperUserResult } from './fetch-user';

// Leagues for User fetching (task-64)
export {
  fetchSleeperLeaguesForUser,
  fetchSleeperLeaguesForUserWithResult,
  fetchSleeperLeaguesForMultipleSeasons,
  invalidateLeaguesForUserCache,
  invalidateAllLeaguesForUser,
  clearLeaguesForUserCache,
  getLeaguesForUserCacheStats,
  getLeagueType,
  getAvatarUrl,
  getCurrentSeason,
  getLeaguesForUserEndpoint,
  LEAGUES_CACHE_TTL_MS,
} from './fetch-leagues-for-user';

export type { FetchSleeperLeaguesForUserResult, LeagueType } from './fetch-leagues-for-user';

// Roster fetching
export {
  fetchSleeperRosters,
  fetchSleeperRostersWithResult,
  invalidateRostersCache,
  clearRostersCache,
  getRostersCacheStats,
  mapRosterIdsToRecords,
  mapOwnerIdsToRosterIds,
  ROSTERS_CACHE_TTL_MS,
} from './fetch-rosters';

export type { FetchSleeperRostersResult } from './fetch-rosters';

// Matchup fetching
export {
  fetchSleeperMatchups,
  fetchSleeperMatchupsWithResult,
  invalidateMatchupsCache,
  invalidateLeagueMatchupsCache,
  clearMatchupsCache,
  getMatchupsCacheStats,
  pairMatchups,
  determineWinner,
  isWeekComplete,
  getByeWeekTeams,
  getRosterPoints,
  mapRosterIdsToMatchups,
  MATCHUPS_CACHE_TTL_MS,
} from './fetch-matchups';

export type { FetchSleeperMatchupsResult, MatchupPair } from './fetch-matchups';

// Transaction fetching
export {
  fetchSleeperTransactions,
  fetchSleeperTransactionsWithResult,
  invalidateTransactionsCache,
  invalidateLeagueTransactionsCache,
  clearTransactionsCache,
  getTransactionsCacheStats,
  filterTransactions,
  getTradeTransactions,
  getWaiverTransactions,
  getFreeAgentTransactions,
  getTransactionsByRoster,
  getTransactionsByPlayer,
  getPendingTransactions,
  getCompletedTransactions,
  sortTransactionsByTime,
  getAllPlayersAdded,
  getAllPlayersDropped,
  mapTransactionIdsToData,
  TRANSACTIONS_CACHE_TTL_MS,
} from './fetch-transactions';

export type { FetchSleeperTransactionsResult } from './fetch-transactions';

// Player database fetching
export {
  fetchSleeperPlayers,
  fetchSleeperPlayersWithResult,
  invalidatePlayersCache,
  clearPlayersCache,
  getPlayersCacheStats,
  createPlayerLookupMap,
  getPlayerById,
  filterPlayersByPosition,
  filterPlayersByTeam,
  filterPlayersByStatus,
  getActivePlayers,
  getInjuredPlayers,
  searchPlayersByName,
  getPlayerCountByPosition,
  getPlayerCountByTeam,
  PLAYERS_CACHE_TTL_MS,
} from './fetch-players';

export type { FetchSleeperPlayersResult } from './fetch-players';

// NFL State fetching
export {
  fetchSleeperNFLState,
  fetchSleeperNFLStateWithResult,
  fetchSleeperNFLStateInfo,
  invalidateNFLStateCache,
  clearNFLStateCache,
  getNFLStateCacheStats,
  getNFLStateInfo,
  getPlayoffWeekRanges,
  isPickemsEnabled,
  getCurrentWeekDisplay,
  NFL_STATE_CACHE_TTL_MS,
} from './fetch-nfl-state';

export type { FetchSleeperNFLStateResult, NFLStateInfo, PlayoffWeekRanges } from './fetch-nfl-state';

// Circuit Breaker pattern for resilience
export {
  withCircuitBreaker,
  withCircuitBreakerAndRetry,
  calculateBackoffDelay,
  sleep,
  getCircuitState,
  getCircuitStatus,
  getAllCircuitStatuses,
  resetCircuit,
  resetAllCircuits,
  removeCircuit,
  clearAllCircuits,
  addStateChangeListener,
  getLeagueEndpoint,
  getRostersEndpoint,
  getMatchupsEndpoint,
  getTransactionsEndpoint,
  getPlayersEndpoint,
  getNFLStateEndpoint,
  FAILURE_THRESHOLD,
  COOLDOWN_MS,
  SUCCESS_THRESHOLD,
  BASE_BACKOFF_DELAY_MS,
  MAX_BACKOFF_DELAY_MS,
  MAX_RETRY_ATTEMPTS,
} from './circuit-breaker';

export type {
  CircuitState,
  CircuitBreakerOptions,
  CircuitBreakerResult,
  FetchFunction,
  FallbackFunction,
} from './circuit-breaker';

// Differential Sync with Checksum Logic
export {
  computeChecksum,
  computeStrongChecksum,
  hasChanges,
  computeLeagueChecksum,
  computeRosterChecksum,
  computeMatchupChecksum,
  computeTransactionChecksum,
  computePlayerChecksum,
  compareBatch,
  compareRostersBatch,
  compareMatchupsBatch,
  compareTransactionsBatch,
  getChecksumKey,
  storeChecksum,
  storeChecksums,
  getStoredChecksum,
  getStoredChecksums,
  clearLeagueChecksums,
  clearAllChecksums,
  getChecksumCacheStats,
  differentialSyncRosters,
  differentialSyncMatchups,
  differentialSyncTransactions,
  computeLeagueDataChecksum,
} from './differential-sync';

export type {
  SyncEntityType,
  ChecksumComparisonResult,
  DifferentialSyncResult,
  ChecksumMetadata,
  ChecksumOptions,
} from './differential-sync';
