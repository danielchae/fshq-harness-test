# Sleeper API Official Specification

**Source:** https://docs.sleeper.com/
**Last Updated:** December 2025

## Authentication

**No API token required.** The API is read-only, allowing access to a user's leagues, drafts, and rosters without modification capabilities. This eliminates the need for OAuth flows, API key management, or authentication headers.

## Rate Limiting

**Soft limit: 1000 API calls per minute**

Stay under this threshold to avoid IP blocking. The API does not return rate limit headers, so applications should implement client-side throttling.

## Base URL

```
https://api.sleeper.app/v1
```

All endpoints use HTTPS with standard REST conventions.

---

## User Endpoints

### Get User by Username
```
GET /user/<username>
```

Retrieve user information using their Sleeper username.

**Response:**
```json
{
  "username": "john_doe",
  "user_id": "12345678",
  "display_name": "John Doe",
  "avatar": "cc12ec49965eb7856f84d71cf85306af"
}
```

### Get User by ID
```
GET /user/<user_id>
```

Retrieve user information by their unique user ID.

---

## League Endpoints

### Get User's Leagues
```
GET /user/<user_id>/leagues/<sport>/<season>
```

**Parameters:**
- `sport`: "nfl", "nba", etc.
- `season`: Year (e.g., "2025")

Returns all leagues a user participated in for a given sport and season.

### Get League Details
```
GET /league/<league_id>
```

Returns complete league configuration including:
- League name and avatar
- Scoring settings
- Roster positions
- Playoff settings
- Season information

### Get League Rosters
```
GET /league/<league_id>/rosters
```

**Response includes:**
- `starters`: Array of player IDs currently starting
- `players`: All players on roster
- `reserve`: IR/taxi squad players
- `settings`: Wins, losses, fpts, fpts_against
- `roster_id`: Unique roster identifier
- `owner_id`: User ID of team owner

### Get League Users
```
GET /league/<league_id>/users
```

Returns all participants with display names, avatars, and metadata (team nicknames).

### Get Matchups
```
GET /league/<league_id>/matchups/<week>
```

**Parameters:**
- `week`: 1-18 for regular season, varies for playoffs

**Response includes:**
- `matchup_id`: Groups two rosters playing each other
- `roster_id`: Team identifier
- `points`: Total points scored
- `starters`: Player IDs of starting lineup
- `players`: All players on roster
- `custom_points`: Custom scoring if applicable

### Get Playoff Brackets
```
GET /league/<league_id>/winners_bracket
GET /league/<league_id>/losers_bracket
```

Returns playoff bracket structure with matchups and results.

### Get Transactions
```
GET /league/<league_id>/transactions/<round>
```

**Parameters:**
- `round`: Week number (1-18)

**Transaction Types:**
- `trade`: Player trades between teams
- `free_agent`: FA pickups
- `waiver`: Waiver claims

**Response includes:**
- `adds`: { "player_id": roster_id }
- `drops`: { "player_id": roster_id }
- `draft_picks`: Draft pick trades
- `waiver_budget`: FAAB spending
- `status_updated`: Timestamp

### Get Traded Picks
```
GET /league/<league_id>/traded_picks
```

Returns all draft pick trades in the league, including future picks.

---

## Draft Endpoints

### Get User's Drafts
```
GET /user/<user_id>/drafts/<sport>/<season>
```

Returns all drafts user participated in.

### Get League Drafts
```
GET /league/<league_id>/drafts
```

Returns all drafts associated with a league.

### Get Draft Details
```
GET /draft/<draft_id>
```

Returns draft configuration, settings, and status.

### Get Draft Picks
```
GET /draft/<draft_id>/picks
```

**Response includes:**
- `player_id`: Selected player
- `picked_by`: User ID who made pick
- `roster_id`: Team that owns pick
- `round`: Draft round
- `draft_slot`: Position in round
- `pick_no`: Overall pick number
- `metadata`: Player info (team, position, status)

### Get Traded Draft Picks
```
GET /draft/<draft_id>/traded_picks
```

Returns all pick trades made during or before draft.

---

## Player Endpoints

### Get All Players
```
GET /players/<sport>
```

**WARNING: Response size ~5MB**

Returns complete player database with:
- `player_id`: Unique identifier
- `first_name`, `last_name`
- `position`: QB, RB, WR, TE, etc.
- `team`: Current NFL team (null if FA)
- `status`: Active, Injured Reserve, etc.
- `injury_status`: Questionable, Out, etc.
- `age`, `number`, `years_exp`

**Best Practice:** Cache locally and refresh once per day maximum.

### Get Trending Players
```
GET /players/<sport>/trending/<type>
```

**Parameters:**
- `type`: "add" or "drop"

Returns most added/dropped players across all Sleeper leagues.

---

## State Endpoint

### Get Sport State
```
GET /state/<sport>
```

Returns current season, week, and phase information:
```json
{
  "week": 14,
  "season_type": "regular",
  "season": "2025",
  "leg": 1
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 429 | Rate Limit Exceeded - Too many requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Temporary outage |

---

## Data Models

### Roster Object
```json
{
  "starters": ["4046", "7523", "8112"],
  "settings": {
    "wins": 8,
    "losses": 5,
    "ties": 0,
    "fpts": 1523.42,
    "fpts_against": 1398.76
  },
  "roster_id": 1,
  "reserve": ["8156"],
  "players": ["4046", "7523", "8112", "8156"],
  "player_map": {},
  "owner_id": "12345678",
  "league_id": "987654321"
}
```

### Matchup Object
```json
{
  "starters": ["4046", "7523", "8112"],
  "roster_id": 1,
  "players": ["4046", "7523", "8112"],
  "matchup_id": 1,
  "points": 128.42,
  "custom_points": null
}
```

### Transaction Object
```json
{
  "type": "trade",
  "transaction_id": "123456789",
  "status_updated": 1638316800000,
  "status": "complete",
  "roster_ids": [1, 2],
  "adds": {
    "4046": 1,
    "7523": 2
  },
  "drops": {
    "8112": 1,
    "9234": 2
  },
  "draft_picks": [],
  "waiver_budget": []
}
```

---

## Best Practices

1. **Caching:** Cache player data locally, refresh once per day
2. **Batch Requests:** Combine related data fetches when possible
3. **Error Handling:** Implement retry logic with exponential backoff
4. **Polling Intervals:**
   - During games: 60 seconds
   - Off-hours: 5 minutes
5. **Data Validation:** Always check for null/missing fields in responses

---

## Known Limitations

- **Read-only:** No write operations supported
- **No webhooks:** Polling required for real-time updates
- **No historical stats:** Only current season data readily available
- **Player IDs:** Sleeper uses proprietary player IDs, not NFL GSIS IDs
- **Rate limits:** Soft limit without header feedback
