# Integration Workflows - FSHQ.gg
## Phase 3.3: Integration Functions Specifications

**Status:** ✅ Complete
**Primary Deliverable:** [06-integration-functions.json](./06-integration-functions.json)
**External Systems:** Sleeper API (Fantasy Sports Platform)

---

## Executive Summary

This specification defines comprehensive integration patterns for FSHQ.gg's primary external system integration: **Sleeper API**. The architecture implements adaptive polling with differential synchronization, automated moment generation from external events, stat correction detection with re-grading workflows, and comprehensive error handling with circuit breakers.

**Key Metrics:**
- 19 integration functions defined
- 8 multi-system workflows orchestrated
- 8 data synchronization patterns specified
- Adaptive polling: 5min (live games) → 1hr (season) → 24hr (off-season)
- Rate limiting: 900 req/min (under 1000/min API limit)
- Caching strategy: 24h (static) → 1h (rosters) → 5min (live scores)

---

## Architecture Overview

### Integration Patterns

1. **Adaptive Polling Strategy**
   - Adjusts sync frequency based on NFL season state and day/time
   - 5-minute intervals during game days (Thu, Sun, Mon 1pm-11pm ET)
   - 1-hour intervals on off-game days during regular season
   - 24-hour intervals during off-season
   - 2-minute intervals during playoff weeks (all days)

2. **Differential Synchronization**
   - Tracks last sync timestamp per league and data type
   - Uses MD5 checksums to detect changed data
   - Updates only entities with changed checksums
   - Preserves partial sync progress for recovery

3. **Error Handling & Resilience**
   - **Circuit Breaker**: Opens after 5 consecutive failures, half-open after 60s timeout
   - **Exponential Backoff**: Retry with 1s, 2s, 4s delays (max 60s)
   - **Rate Limiting**: Client-side throttling with sliding window (900/min)
   - **Partial Sync Recovery**: Preserves progress to avoid redundant work

4. **Caching Strategy**
   | Data Type | TTL | Rationale |
   |-----------|-----|-----------|
   | Player Database | 24 hours | Updates once daily max |
   | League Settings | 24 hours | Rarely changes mid-season |
   | Team Rosters | 1 hour | Updates with transactions |
   | Weekly Matchups | 5 minutes (live) | Real-time during games |
   | Draft Results | Permanent | Historical, never changes |

---

## Multi-System Workflows

### 1. Initial League Sync
**Trigger:** User connects new Sleeper league
**Duration:** ~2-5 minutes depending on league history
**Steps:**
1. Validate Sleeper league_id and accessibility
2. Fetch league configuration and settings
3. Map team rosters to FSHQ teams
4. Fetch all users (owners) with display names
5. Fetch NFL player database for resolution
6. Fetch complete transaction history
7. Fetch all draft results if available
8. Fetch all weekly matchups for current season
9. Calculate initial standings
10. Schedule ongoing sync jobs

**Rollback:** Mark league as `connection_failed`, allow retry. Partial data preserved for differential sync.

### 2. Weekly Matchup Sync
**Trigger:** Scheduled (5min during games, 1hr off-games)
**Duration:** ~5-15 seconds
**Steps:**
1. Fetch NFL season state for active week
2. Fetch matchup data from Sleeper API
3. Differential sync with checksum comparison
4. Update changed matchup scores
5. Generate match result moments if finalized
6. Update team records and standings
7. Log sync completion

**Rollback:** No rollback needed - additive sync, retry on next interval.

### 3. Stat Correction Detection & Re-grade
**Trigger:** Scheduled monitoring (4hr intervals for 72hr post-week)
**Duration:** ~30-60 seconds
**Steps:**
1. Fetch matchup data for completed weeks in correction window
2. Compare current vs stored scores via checksum
3. Detect changes >0.1 points as stat corrections
4. Log correction events with old/new scores
5. Identify affected pick'ems and predictions
6. Recalculate winners based on corrected scores
7. Update leaderboards atomically
8. Mark predictions as re-graded with timestamp
9. Generate corrected moment with explanation
10. Send notifications to affected users

**Rollback:** Preserve original grades on failure, allow manual re-grade. Notifications sent last to avoid premature alerts.

### 4. Transaction Sync & Moment Generation
**Trigger:** Scheduled (hourly during season, daily off-season)
**Duration:** ~10-30 seconds
**Steps:**
1. Fetch recent transactions from Sleeper API
2. Differential sync - identify new transactions
3. Deduplicate - check if moment exists
4. Generate automated moment by type (trade/waiver/FA)
5. Format content with teams, players, metadata
6. Classify and tag moment appropriately
7. Publish to league newsfeed
8. Update team rosters if applicable
9. Log processing completion

**Rollback:** No rollback - deduplication prevents duplicates, regenerate on next sync if failed.

### 5. Playoff Milestone Detection
**Trigger:** After weekly matchup sync during playoff race
**Duration:** ~5-10 seconds
**Steps:**
1. Calculate standings with tiebreakers
2. Determine remaining schedule and max wins
3. Identify clinched playoff spots
4. Identify eliminated teams
5. Check for existing milestone moments (dedupe)
6. Generate clinch/elimination moments
7. Mark as major milestones for prominence
8. Update team playoff status

**Rollback:** Idempotent via deduplication, retry on next standings calculation.

### 6. Championship Finalization
**Trigger:** Championship week complete + 72hr stat correction period
**Duration:** ~15-30 seconds
**Steps:**
1. Verify championship scores finalized
2. Confirm no stat corrections in last 24hr
3. Determine winner, runner-up from bracket
4. Determine 3rd place, consolation winners
5. Generate championship moment
6. Mark as permanent league history
7. Update final standings with playoff results
8. Calculate/store final season statistics
9. Archive complete season data
10. Trigger end-of-season workflows

**Rollback:** If fails before moment published, mark `pending_finalization` and retry. After published, stat corrections trigger separate corrected moment.

### 7. Sync Failure Recovery
**Trigger:** Sync job fails after retries or circuit opens
**Duration:** Varies (1min to 15min retry window)
**Steps:**
1. Log detailed error with request/response
2. Classify as transient or permanent failure
3. Schedule exponential backoff retry if transient
4. Mark failed and notify admin if permanent
5. Preserve partial progress for recovery
6. Wait for circuit breaker timeout if opened
7. Alert after 4 consecutive failures
8. Reset counters on success, resume normal schedule

**Rollback:** No rollback - automatic retry with progress preservation.

### 8. Adaptive Polling Adjustment
**Trigger:** NFL season state change or daily adjustment
**Duration:** ~2-5 seconds
**Steps:**
1. Fetch NFL season state
2. Determine day of week and time
3. Calculate appropriate sync interval
4. Update scheduled sync jobs for all leagues
5. Log frequency adjustment with reasoning
6. Prioritize critical data during active periods
7. Reduce polling during off-season

**Rollback:** No rollback - if adjustment fails, existing schedule continues.

---

## Data Synchronization Patterns

### Real-Time Sync
- **Weekly Matchups**: 5min during games → scores update near real-time
- **NFL Season State**: Hourly check → polling adjustments within 1hr

### Batch Sync
- **Team Rosters**: Hourly during season, daily off-season → 1hr staleness
- **Transactions**: Hourly during season → moments within 1hr
- **Player Database**: Weekly during season → max 7-day staleness
- **Stat Corrections**: 4hr checks for 72hr post-week → 4hr detection latency

### Event-Driven Sync
- **League Settings**: On-change (24h cache refresh) → 24hr staleness max
- **Draft Results**: On-demand when draft completes → permanent once synced

---

## Key Integration Functions

### Data Fetching (8 functions)
- `fetchSleeperLeague` - League configuration
- `fetchSleeperRosters` - Team rosters and owners
- `fetchSleeperMatchups` - Weekly scores
- `fetchSleeperTransactions` - Trades, waivers, FA moves
- `fetchSleeperDrafts` - Draft list
- `fetchSleeperDraftPicks` - Draft results
- `fetchSleeperPlayers` - NFL player database
- `fetchSleeperNFLState` - Season state

### Sync Orchestration (5 functions)
- `syncLeagueComplete` - Full league sync orchestration
- `performDifferentialSync` - Checksum-based differential sync
- `calculateSyncInterval` - Adaptive polling frequency
- `detectStatCorrections` - Score change detection
- `triggerReGrading` - Recalculate affected predictions

### Error Handling (3 functions)
- `retryWithBackoff` - Exponential backoff retry
- `implementCircuitBreaker` - Cascade failure prevention
- `rateLimit` - Client-side API throttling

### Workflow Triggers (3 functions)
- `deduplicateMoment` - Prevent duplicate feed posts
- `generateAutomatedMoment` - Create feed moments from events
- `validateSleeperAPIKey` - League accessibility check

---

## Business Rules Summary

### Authentication
- **Sleeper API is public** - no authentication required
- Only validate league_id accessibility before sync

### Caching
- Player database: 24h (updates daily max)
- League settings: 24h (rarely changes)
- Rosters: 1h (transaction updates)
- Live matchups: 5min (real-time games)
- Completed matchups: 72h (stat correction window)

### Rate Limiting
- Stay under 1000 req/min (Sleeper limit)
- Client-side throttle at 900 req/min for safety margin
- Prioritize critical requests (live scores) over historical data

### Error Recovery
- Circuit breaker opens after 5 failures
- Exponential backoff: 1s → 2s → 4s (max 60s)
- Alert admins after 4 consecutive failures
- Preserve partial sync progress for recovery

### Stat Corrections
- Monitor completed matchups for 72 hours post-week
- Detect score changes >0.1 points as corrections
- Trigger re-grading for affected pick'ems/predictions
- Generate corrected moments with explanations

### Moment Deduplication
- Use combination of `(event_type, timestamp, entities)` as unique key
- Allow updates for stat corrections without creating duplicates
- Handle cancelled transactions by marking moments as superseded

---

## Architecture Decision Records

### ADR-001: Adaptive Polling Over Webhooks
**Decision:** Implement adaptive polling instead of webhook subscriptions
**Rationale:** Sleeper API has no webhook support, polling is only option
**Trade-offs:**
- ✅ Simple to implement and maintain
- ✅ Fine-grained control over frequency
- ❌ 5-minute delay during live games (acceptable for use case)
- ❌ Higher API call volume (mitigated by rate limiting and caching)

### ADR-002: Differential Sync with Checksums
**Decision:** Use MD5 checksums for change detection
**Rationale:** Avoid reprocessing unchanged data, reduce database writes
**Trade-offs:**
- ✅ Significant reduction in database writes (70-90% during low-activity periods)
- ✅ Faster sync completion times
- ❌ Slight computational overhead for checksum calculation (negligible)

### ADR-003: Circuit Breaker Pattern
**Decision:** Implement circuit breaker for external API calls
**Rationale:** Prevent cascade failures when Sleeper API is degraded
**Trade-offs:**
- ✅ System remains stable during external API outages
- ✅ Reduces unnecessary API calls to failing service
- ❌ Temporary data staleness during circuit open state (acceptable)

### ADR-004: Stat Correction 72-Hour Window
**Decision:** Monitor completed matchups for 72 hours for stat corrections
**Rationale:** NFL stat corrections typically occur within 48-72 hours
**Trade-offs:**
- ✅ Catches all official stat corrections
- ✅ Maintains accuracy of pick'ems and predictions
- ❌ Additional API calls for historical data (mitigated by 4hr check interval)

### ADR-005: Service Layer Abstraction
**Decision:** Centralize all Sleeper API calls in service layer
**Rationale:** Single source of truth, easier testing, centralized error handling
**Trade-offs:**
- ✅ Simplified testing with mock services
- ✅ Centralized caching and rate limiting logic
- ✅ Easier to swap external providers in future
- ❌ Additional abstraction layer (worth the maintainability benefits)

---

## Implementation Ready

This specification is **implementation-ready** for Phase 3.6 (Business Logic) to reference when implementing:
- Sync job schedulers
- Moment generation logic
- Re-grading workflows
- Error handling middleware

All functions define **WHAT** needs to happen, not **HOW** to implement. Developers have flexibility in implementation details while meeting the specified requirements.

---

**Next Phase:** Phase 3.4 (Application States) will reference these workflows for state transition triggers.
