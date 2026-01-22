# Sleeper API Python Wrapper Reference

**GitHub:** https://github.com/SwapnikKatkoori/sleeper-api-wrapper
**PyPI:** https://pypi.org/project/sleeper-api-wrapper/
**Version:** 1.2.1 (Released November 2025)

## Overview

The `sleeper-api-wrapper` is a Python library that provides typed access to all Sleeper API endpoints. It converts JSON responses into Python objects for easier usage and is compatible with Python 3.5+.

## Installation

```bash
pip install sleeper-api-wrapper
```

## Dependencies

- **requests:** HTTP operations
- **pytest:** Testing framework (dev dependency)

---

## Core Classes

### League Class

The `League` class provides access to all league-related endpoints.

#### Initialization

```python
from sleeper_wrapper import League

league = League(league_id="987654321")
```

#### Methods

**get_league()**
```python
league_info = league.get_league()
# Returns: Dict with league settings, scoring, roster config
```

**get_rosters()**
```python
rosters = league.get_rosters()
# Returns: List of roster objects with players, starters, settings
```

**get_users()**
```python
users = league.get_users()
# Returns: List of user objects with display_name, avatar, metadata
```

**get_matchups(week)**
```python
matchups = league.get_matchups(week=14)
# Parameters:
#   - week: int (1-18)
# Returns: List of matchup objects grouped by matchup_id
```

**get_playoff_winners_bracket()**
```python
winners = league.get_playoff_winners_bracket()
# Returns: Playoff bracket structure for winners
```

**get_playoff_losers_bracket()**
```python
losers = league.get_playoff_losers_bracket()
# Returns: Consolation bracket structure
```

**get_transactions(week)**
```python
transactions = league.get_transactions(week=14)
# Parameters:
#   - week: int
# Returns: List of trades, waivers, and FA moves for that week
```

**get_traded_picks()**
```python
picks = league.get_traded_picks()
# Returns: All draft pick trades in the league
```

**get_all_drafts()**
```python
drafts = league.get_all_drafts()
# Returns: Historical draft information for the league
```

**get_standings(rosters, users)**
```python
standings = league.get_standings(rosters, users)
# Parameters:
#   - rosters: Output from get_rosters()
#   - users: Output from get_users()
# Returns: Ranked list sorted by wins/losses
```

**get_scoreboards(rosters, matchups, users, score_type, week)**
```python
scoreboards = league.get_scoreboards(
    rosters=rosters,
    matchups=matchups,
    users=users,
    score_type="pts_std",  # or "pts_ppr", "pts_half_ppr"
    week=14
)
# Returns: Formatted matchup scores with team info
```

**get_close_games(scoreboards, close_num)**
```python
close = league.get_close_games(scoreboards, close_num=5.0)
# Parameters:
#   - scoreboards: Output from get_scoreboards()
#   - close_num: Point margin threshold (float)
# Returns: Games within specified point margin
```

---

### User Class

The `User` class provides access to user-related endpoints.

#### Initialization

```python
from sleeper_wrapper import User

# By username
user = User("john_doe")

# By user ID
user = User("12345678")
```

#### Methods

**get_user()**
```python
user_info = user.get_user()
# Returns: Dict with username, user_id, display_name, avatar
```

**get_all_leagues(sport, season)**
```python
leagues = user.get_all_leagues(sport="nfl", season="2025")
# Parameters:
#   - sport: str ("nfl", "nba", etc.)
#   - season: str (year)
# Returns: List of all leagues user participated in
```

**get_all_drafts(sport, season)**
```python
drafts = user.get_all_drafts(sport="nfl", season="2025")
# Returns: User's draft history for sport/season
```

**get_username()**
```python
username = user.get_username()
# Returns: str - Sleeper username
```

**get_user_id()**
```python
user_id = user.get_user_id()
# Returns: str - Unique user ID
```

---

### Stats Class

The `Stats` class provides access to player performance data.

#### Methods

**get_all_stats()**
```python
from sleeper_wrapper import Stats

stats = Stats.get_all_stats()
# Returns: Complete player stats for current season
```

**get_week_stats(season_type, season, week)**
```python
week_stats = Stats.get_week_stats(
    season_type="regular",
    season="2025",
    week=14
)
# Returns: Player stats for specific week
```

**get_all_projections()**
```python
projections = Stats.get_all_projections()
# Returns: Season-long player projections
```

**get_week_projections(season, week)**
```python
week_proj = Stats.get_week_projections(season="2025", week=14)
# Returns: Weekly player projections
```

**get_player_week_score(week_stats, player_id)**
```python
score = Stats.get_player_week_score(
    week_stats=week_stats,
    player_id="4046"
)
# Returns: Individual player's score for the week
```

---

### Players Class

The `Players` class provides access to player database and trends.

#### Methods

**get_all_players()**
```python
from sleeper_wrapper import Players

all_players = Players.get_all_players()
# Returns: Dict of all players (5MB+ response)
# Warning: Call once per day maximum
```

**get_trending_players(sport, add_drop, hours, limit)**
```python
trending = Players.get_trending_players(
    sport="nfl",
    add_drop="add",  # or "drop"
    hours=24,
    limit=25
)
# Returns: Most added/dropped players in last X hours
```

---

## Usage Examples

### Get League Standings

```python
from sleeper_wrapper import League

league = League("987654321")

# Fetch required data
rosters = league.get_rosters()
users = league.get_users()

# Calculate standings
standings = league.get_standings(rosters, users)

for i, team in enumerate(standings, 1):
    print(f"{i}. {team['display_name']}: {team['wins']}-{team['losses']}")
```

### Get Weekly Matchup Results

```python
from sleeper_wrapper import League

league = League("987654321")
week = 14

rosters = league.get_rosters()
matchups = league.get_matchups(week)
users = league.get_users()

scoreboards = league.get_scoreboards(
    rosters=rosters,
    matchups=matchups,
    users=users,
    score_type="pts_ppr",
    week=week
)

for matchup in scoreboards:
    print(f"{matchup['team1_name']} {matchup['team1_score']} - "
          f"{matchup['team2_score']} {matchup['team2_name']}")
```

### Track All League Transactions

```python
from sleeper_wrapper import League

league = League("987654321")
all_players = Players.get_all_players()

for week in range(1, 15):
    transactions = league.get_transactions(week)

    for txn in transactions:
        if txn['type'] == 'trade':
            print(f"Week {week}: Trade executed")
            for player_id, roster_id in txn['adds'].items():
                player = all_players[player_id]
                print(f"  {player['full_name']} -> Roster {roster_id}")
```

### Get User's League Portfolio

```python
from sleeper_wrapper import User

user = User("john_doe")

# Get all NFL leagues for 2025
leagues = user.get_all_leagues(sport="nfl", season="2025")

print(f"User participates in {len(leagues)} leagues:")
for lg in leagues:
    print(f"  - {lg['name']} ({lg['total_rosters']} teams)")
```

### Find Close Games

```python
from sleeper_wrapper import League

league = League("987654321")
week = 14

rosters = league.get_rosters()
matchups = league.get_matchups(week)
users = league.get_users()

scoreboards = league.get_scoreboards(
    rosters=rosters,
    matchups=matchups,
    users=users,
    score_type="pts_ppr",
    week=week
)

# Find games within 3 points
close_games = league.get_close_games(scoreboards, close_num=3.0)

print(f"Found {len(close_games)} nail-biters:")
for game in close_games:
    margin = abs(game['team1_score'] - game['team2_score'])
    print(f"  {game['team1_name']} vs {game['team2_name']}: {margin:.2f} pts")
```

---

## Type Hints & Error Handling

The wrapper returns standard Python dictionaries and lists. Always implement error handling for network failures:

```python
from sleeper_wrapper import League
import requests

try:
    league = League("987654321")
    rosters = league.get_rosters()
except requests.exceptions.RequestException as e:
    print(f"API Error: {e}")
except KeyError as e:
    print(f"Unexpected data structure: {e}")
```

---

## Performance Considerations

1. **Cache player data:** `get_all_players()` returns 5MB+ and should be called once per day
2. **Batch operations:** Fetch rosters/matchups once and reuse
3. **Pagination:** Not required - endpoints return complete datasets
4. **Rate limiting:** Implement client-side throttling (max 1000 calls/min)

---

## Maintenance Status

The wrapper is actively maintained with regular updates. The repository was transferred from @SwapnikKatkoori to @dtsong in March 2022, ensuring continued support and development.

## Alternative Wrappers

- **Go:** https://github.com/lum8rjack/sleeper-go
- **JavaScript:** https://github.com/rsromanowski/sleeper-api
- **R:** ffscrapr package with Sleeper support
