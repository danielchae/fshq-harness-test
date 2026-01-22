# Sleeper API Integration Research Report

**Project:** FSHQ.gg Fantasy Sports Platform
**Integration Target:** Sleeper Fantasy Football/Basketball Platform
**Research Date:** December 2025
**Status:** Initial Fantasy Platform Integration

---

## Executive Summary

Sleeper provides a comprehensive, **free, read-only HTTP API** that is exceptionally well-suited for the FSHQ.gg use case. The API requires **no authentication**, has **generous rate limits (1000 calls/minute)**, and provides complete access to all league data, rosters, matchups, transactions, and player information needed for the fantasy league hub functionality.

**Key Finding:** Sleeper is the ideal starting point for FSHQ.gg's multi-platform fantasy integration strategy due to its zero-friction access model, comprehensive data coverage, and active developer community with mature tooling.

---

## Integration Capabilities

### Core Features Available

Sleeper's API provides complete read-only access to all data required by FSHQ.gg's Statement of Work:

#### 1. **League Identity & Configuration**
- League settings and scoring rules
- Team count and roster configuration
- Playoff bracket structures
- Season and week state information
- **Endpoints:** `GET /league/{league_id}`, `GET /state/nfl`

#### 2. **Team & Roster Data**
- Complete roster composition (starters, bench, IR/taxi)
- Team ownership mapping (user profiles)
- Win/loss records and season statistics
- Points scored and points against
- **Endpoints:** `GET /league/{league_id}/rosters`, `GET /league/{league_id}/users`

#### 3. **Schedule & Matchups**
- Weekly matchup pairings with results
- Real-time scoring updates during games
- Historical matchup data for all weeks
- Playoff bracket progression
- **Endpoints:** `GET /league/{league_id}/matchups/{week}`, `GET /league/{league_id}/winners_bracket`

#### 4. **Transaction History**
- Trades between teams (including draft picks)
- Waiver wire claims with FAAB spending
- Free agent acquisitions
- Weekly transaction logs
- Future draft pick trades
- **Endpoints:** `GET /league/{league_id}/transactions/{week}`, `GET /league/{league_id}/traded_picks`

#### 5. **Player Database**
- Complete NFL/NBA player database (~5MB)
- Player metadata (team, position, status, injury info)
- Real-time trending adds/drops across all Sleeper leagues
- Player performance statistics and projections
- **Endpoints:** `GET /players/nfl`, `GET /players/nfl/trending/add`

#### 6. **Draft Information**
- Complete draft history and results
- Pick-by-pick breakdown with timestamps
- Keeper and rookie draft support
- Draft pick trade history
- **Endpoints:** `GET /league/{league_id}/drafts`, `GET /draft/{draft_id}/picks`

### Data Update Frequency

| Data Type | Update Pattern | FSHQ.gg Sync Strategy |
|-----------|----------------|----------------------|
| **Matchup Scores** | Real-time during games | Poll every 60s on game days |
| **Transactions** | Real-time when processed | Poll hourly, increase on trade deadlines |
| **Rosters** | Immediate after transactions | Poll hourly or on transaction detection |
| **League Settings** | Rarely changes | Cache for 24 hours |
| **Player Database** | Daily updates | Cache locally, refresh once per day |
| **Draft Results** | Real-time during draft | Poll every 30s during active drafts |

---

## Authentication & Security

### Authentication Method

**None required.** The Sleeper API is completely open for read-only access.

**Implications for FSHQ.gg:**
- ✅ No OAuth flow implementation needed
- ✅ No API key management or rotation
- ✅ No user consent screens for data access
- ✅ Instant integration without Sleeper partnership
- ⚠️ Cannot verify user owns the league (trust-based model)
- ⚠️ Cannot write data or perform actions on behalf of users

### Authorization Model

Users will provide their **Sleeper username or league ID** to FSHQ.gg. The platform will then:
1. Fetch user's leagues via `GET /user/{username}/leagues/nfl/2025`
2. Allow user to select which league(s) to sync
3. Poll selected leagues for updates

**Security Considerations:**
- All data is public - anyone with a league ID can access it
- No PII beyond publicly visible display names and avatars
- No financial data or sensitive information exposed
- Rate limiting is per IP, not per user/API key

---

## Rate Limits & Pricing

### Rate Limits

**Soft Limit:** 1000 API calls per minute per IP address

**Enforcement:** IP-based blocking after exceeding threshold. No rate limit headers provided, so client-side throttling is essential.

**FSHQ.gg Impact Analysis:**

Assuming a single FSHQ.gg server instance polling data:
- **Per League Per Week:** ~10 API calls (rosters, matchups, transactions, users)
- **Maximum Leagues Supported:** ~100 leagues with 1-minute polling during games
- **Typical Load:** 500-600 calls/minute during peak game times
- **Headroom:** 40-50% buffer for burst traffic and player database refreshes

**Scaling Strategy:**
- Implement client-side rate limiter (900 calls/min ceiling)
- Use distributed caching (Redis) to minimize duplicate requests
- Deploy regional instances if scaling beyond 100 leagues
- Implement webhook simulation via change detection to reduce polling

### Pricing

**Cost:** $0 - Completely free

**No tiers, no quotas, no credit card required.**

**Cost Comparison:**
| Platform | API Access Cost | Authentication Complexity |
|----------|----------------|--------------------------|
| **Sleeper** | Free | None |
| **ESPN** | Free | OAuth 2.0 required |
| **Yahoo** | Free | OAuth 2.0 + App registration |
| **NFL.com** | Undocumented/Restricted | Complex |

Sleeper's zero-cost, zero-friction model makes it the clear winner for initial integration.

---

## Integration Complexity Assessment

### Difficulty Rating: **2/10 (Very Easy)**

Sleeper is among the easiest fantasy sports APIs to integrate due to:
- ✅ No authentication flow to implement
- ✅ Simple RESTful design with intuitive endpoints
- ✅ Comprehensive, well-maintained documentation
- ✅ Mature ecosystem of wrappers and tools
- ✅ Predictable JSON response structures
- ✅ No write operations to manage or error-prone mutations

### Technical Implementation Effort

**Estimated Development Time:** 1-2 weeks for full integration

| Component | Effort | Notes |
|-----------|--------|-------|
| **API Client** | 2-3 days | HTTP client with retry logic, rate limiting |
| **Data Models** | 1-2 days | TypeScript/Python types for all entities |
| **Sync Engine** | 3-4 days | Polling scheduler, change detection, caching |
| **User Interface** | 2-3 days | League selection, sync status, error handling |
| **Testing** | 2-3 days | Unit tests, integration tests, mocks |
| **Documentation** | 1 day | Internal API docs, runbooks |

**Total:** 11-16 developer days (~2-3 weeks with 1 developer)

### Technical Challenges

#### 1. **Polling Overhead** (Medium)
- **Challenge:** No webhooks mean continuous polling required
- **Solution:** Implement adaptive polling (60s during games, 5 min off-hours) with change detection using checksums
- **Reference:** See `docs/integration-best-practices.md` section on "Real-Time Updates Strategy"

#### 2. **Large Player Database** (Low)
- **Challenge:** 5MB player JSON response
- **Solution:** Cache locally in Redis/database, refresh once daily, build lightweight index
- **Reference:** See `docs/integration-best-practices.md` section on "Data Handling Challenges"

#### 3. **No Native Webhooks** (Medium)
- **Challenge:** Cannot receive push notifications for transactions/scores
- **Solution:** Implement webhook simulation via change detection and configurable polling intervals
- **Reference:** See `docs/integration-best-practices.md` section on "Change Detection"

#### 4. **Player ID Mapping** (Low)
- **Challenge:** Sleeper uses proprietary player IDs, not standard NFL GSIS IDs
- **Solution:** Build internal mapping table, leverage Sleeper's player metadata
- **Reference:** See `docs/official-api-specification.md` section on "Player Endpoints"

### Ongoing Maintenance Needs

**Maintenance Level:** Low

**Routine Tasks:**
- Monitor rate limit usage and adjust polling intervals
- Update player database cache daily
- Handle API version changes (rare - Sleeper maintains v1 stability)
- Add new sports/features as Sleeper expands (NBA, etc.)

**Breaking Change Risk:** Very Low - Sleeper has maintained API stability since 2018 with additive-only changes

---

## Developer Resources

### Official Documentation

**Primary Resource:** [https://docs.sleeper.com/](https://docs.sleeper.com/)
- Comprehensive endpoint reference
- Request/response examples
- Data model specifications
- No registration required to view

**Saved locally:** `docs/official-api-specification.md`

### GitHub Repositories

**Python Wrapper:** [https://github.com/SwapnikKatkoori/sleeper-api-wrapper](https://github.com/SwapnikKatkoori/sleeper-api-wrapper)
- Most popular wrapper with 350+ stars
- Actively maintained (last update Nov 2025)
- Type-safe Python interface
- **Saved locally:** `docs/python-wrapper-reference.md`

**Go Library:** [https://github.com/lum8rjack/sleeper-go](https://github.com/lum8rjack/sleeper-go)
- Complete Go client implementation
- Production-ready with comprehensive tests

**JavaScript/TypeScript:** [https://github.com/rsromanowski/sleeper-api](https://github.com/rsromanowski/sleeper-api)
- Node.js wrapper with TypeScript support
- Good for frontend/backend JavaScript integration

### Developer Guides

**Comprehensive Integration Guide:** [https://zuplo.com/learning-center/sleeper-api](https://zuplo.com/learning-center/sleeper-api)
- Architectural best practices
- Caching strategies
- Error handling patterns
- Real-world implementation examples
- **Saved locally:** `docs/integration-best-practices.md`

### Community Resources

**Reddit:** [r/SleeperApp](https://reddit.com/r/SleeperApp)
- Active community with 50k+ members
- Developer discussions and API questions
- Feature requests and bug reports

**Discord:** Sleeper has an active developer community on Discord for API support and discussion

---

## Technical Specifications Summary

### API Base URL
```
https://api.sleeper.app/v1
```

### Key Endpoints for FSHQ.gg

| Endpoint | Purpose | Polling Frequency |
|----------|---------|-------------------|
| `GET /user/{username}/leagues/nfl/{season}` | Discover user's leagues | Once on initial sync |
| `GET /league/{league_id}` | League configuration | Daily or on-demand |
| `GET /league/{league_id}/rosters` | Team rosters | Hourly |
| `GET /league/{league_id}/users` | Team owners | Daily |
| `GET /league/{league_id}/matchups/{week}` | Weekly matchups | 60s during games |
| `GET /league/{league_id}/transactions/{week}` | Transaction log | Hourly |
| `GET /players/nfl` | Player database | Once daily |

### Response Formats

All responses are JSON. Example roster object:
```json
{
  "starters": ["4046", "7523"],
  "settings": {
    "wins": 8,
    "losses": 5,
    "fpts": 1523.42
  },
  "roster_id": 1,
  "players": ["4046", "7523", "8112"],
  "owner_id": "12345678"
}
```

### Error Codes

| Code | Meaning | FSHQ.gg Handling |
|------|---------|------------------|
| 400 | Bad Request | Log error, notify user of invalid league ID |
| 404 | Not Found | Mark league as inactive/deleted |
| 429 | Rate Limited | Exponential backoff, alert monitoring |
| 500 | Server Error | Retry with backoff, fallback to cached data |
| 503 | Service Unavailable | Display maintenance message to users |

---

## Integration Recommendations

### Phase 1: MVP Integration (Week 1-2)

**Scope:** Basic league syncing with manual refresh

1. Implement core API client with rate limiting
2. Build data models for leagues, rosters, matchups, transactions
3. Create league discovery and selection UI
4. Display current week matchups and standings
5. Show transaction history

**Deliverables:**
- Users can connect Sleeper leagues by username or league ID
- View current week scores and season standings
- Browse transaction history

### Phase 2: Real-Time Updates (Week 3-4)

**Scope:** Automated polling and change detection

1. Implement adaptive polling system (60s during games, 5min off-hours)
2. Add change detection to minimize redundant processing
3. Build notification system for score updates and transactions
4. Implement player database caching and daily refresh
5. Add error handling and retry logic

**Deliverables:**
- Automated score updates during game days
- Push notifications for close games and transactions
- Reliable syncing with graceful error handling

### Phase 3: Advanced Features (Week 5-6)

**Scope:** Analytics and multi-league aggregation

1. Cross-league analytics (user's performance across all leagues)
2. Power rankings and advanced statistics
3. Trade analysis and valuation tools
4. Historical data archiving for season recaps
5. Player trending data integration

**Deliverables:**
- Multi-league dashboard with aggregated stats
- Trade analyzer and draft assistant tools
- Season archives and historical analytics

### Technology Stack Recommendation

**Backend (Python):**
```python
# Core dependencies
requests==2.31.0          # HTTP client
redis==5.0.1              # Caching layer
celery==5.3.4             # Task scheduling for polling
pydantic==2.5.0           # Data validation
fastapi==0.104.1          # API server (if needed)
```

**Backend (TypeScript/Node.js):**
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "ioredis": "^5.3.2",
    "node-cron": "^3.0.3",
    "zod": "^3.22.4"
  }
}
```

**Database:**
- PostgreSQL for league data, rosters, matchups, transactions
- Redis for caching player database and recent API responses
- TimescaleDB extension (optional) for time-series score data

---

## Risk Assessment

### Low Risk Factors ✅

- **API Stability:** Sleeper has maintained v1 API since 2018 with no breaking changes
- **Documentation Quality:** Comprehensive and actively maintained
- **Rate Limits:** Generous 1000/min limit sufficient for hundreds of leagues
- **Cost:** Free with no pricing changes expected
- **Community Support:** Large developer community and mature tooling

### Medium Risk Factors ⚠️

- **No Webhooks:** Polling-based architecture increases complexity and latency
  - *Mitigation:* Adaptive polling + change detection minimize impact
- **IP-Based Rate Limiting:** Scaling requires distributed architecture
  - *Mitigation:* Deploy regional instances or use proxy rotation if needed
- **Proprietary Player IDs:** Requires mapping layer for cross-platform features
  - *Mitigation:* Build internal player ID mapping table

### High Risk Factors ❌

- None identified. Sleeper API is exceptionally well-suited for this use case.

---

## Competitive Analysis

| Feature | Sleeper | ESPN | Yahoo | NFL.com |
|---------|---------|------|-------|---------|
| **Authentication** | None | OAuth 2.0 | OAuth 2.0 | Undocumented |
| **Rate Limits** | 1000/min | Undocumented | 2000/day | Unknown |
| **Cost** | Free | Free | Free | Unknown |
| **Documentation** | Excellent | Good | Fair | Poor |
| **Webhooks** | No | No | No | No |
| **Player Database** | Yes | Yes | Yes | Yes |
| **Historical Data** | Current season | Multi-season | Multi-season | Limited |
| **Developer Community** | Large | Medium | Medium | Small |

**Winner:** Sleeper for initial integration due to zero authentication friction and excellent documentation.

---

## Next Steps for FSHQ.gg Development

1. **Immediate (This Week):**
   - Review all documentation in `docs/` folder
   - Set up development environment with Python or TypeScript
   - Create proof-of-concept that fetches a test league's matchups
   - Test rate limiting behavior with burst traffic

2. **Short-Term (Weeks 1-2):**
   - Build core API client with error handling and retry logic
   - Implement data models for all Sleeper entities
   - Create database schema for storing synced league data
   - Develop league selection and connection UI

3. **Medium-Term (Weeks 3-4):**
   - Deploy automated polling system with change detection
   - Integrate Redis caching layer
   - Implement notification system for score updates
   - Build admin dashboard for monitoring sync health

4. **Long-Term (Weeks 5+):**
   - Add advanced analytics and multi-league aggregation
   - Expand to additional platforms (ESPN, Yahoo) using lessons learned
   - Optimize polling algorithms based on real usage patterns
   - Build out social features (league chat, power rankings)

---

## Conclusion

The Sleeper API represents the **optimal starting point** for FSHQ.gg's fantasy platform integration strategy. Its zero-authentication model, comprehensive data coverage, generous rate limits, and excellent documentation make it significantly easier to integrate than competing platforms.

**Integration Difficulty:** Very Low (2/10)
**Ongoing Maintenance:** Low
**Cost:** $0
**Time to MVP:** 1-2 weeks
**Recommended Priority:** Highest (Initial platform integration)

The comprehensive documentation saved in `docs/` provides everything needed to begin development immediately. The Python wrapper (`docs/python-wrapper-reference.md`) can accelerate initial implementation, while the best practices guide (`docs/integration-best-practices.md`) offers production-ready architectural patterns.

**Development should begin with Sleeper as the foundational integration**, with lessons learned informing the architecture for subsequent ESPN, Yahoo, and NFL.com integrations.

---

## Sources

- [Sleeper API Official Documentation](https://docs.sleeper.com/)
- [A Comprehensive Guide to the Sleeper API - Zuplo](https://zuplo.com/learning-center/sleeper-api)
- [sleeper-api-wrapper - PyPI](https://pypi.org/project/sleeper-api-wrapper/)
- [SwapnikKatkoori/sleeper-api-wrapper - GitHub](https://github.com/SwapnikKatkoori/sleeper-api-wrapper)
- [lum8rjack/sleeper-go - GitHub](https://github.com/lum8rjack/sleeper-go)
- [rsromanowski/sleeper-api - GitHub](https://github.com/rsromanowski/sleeper-api)
- [A Comprehensive Guide to the Sleeper API - DEV Community](https://dev.to/zuplo/a-comprehensive-guide-to-the-sleeper-api-4a98)
- [Sleeper API MCP - LangDB](https://langdb.ai/app/mcp-servers/sleeper-api-mcp-2bef2d2b-8e7c-48d3-bdc1-53c6318c61e1)
- [Sleeper API - SportsFirst](https://www.sportsfirst.net/sportsapi/sleeperapi)
