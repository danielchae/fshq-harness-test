# Sleeper API Integration Best Practices

**Source:** https://zuplo.com/learning-center/sleeper-api
**Last Updated:** December 2025

## Architecture Patterns

### Service Layer Abstraction

Create a centralized service layer that encapsulates all API interactions. This decouples business logic from API dependencies and improves maintainability.

```python
class SleeperService:
    BASE_URL = "https://api.sleeper.app/v1"

    def __init__(self):
        self.session = requests.Session()
        self.cache = {}

    def get_user(self, username: str) -> Dict:
        """Retrieve user with caching"""
        if username in self.cache:
            return self.cache[username]

        response = self.session.get(f"{self.BASE_URL}/user/{username}")
        user_data = response.json()
        self.cache[username] = user_data
        return user_data

    def get_league(self, league_id: str) -> Dict:
        """Retrieve league configuration"""
        response = self.session.get(f"{self.BASE_URL}/league/{league_id}")
        return response.json()

    def get_weekly_matchups(self, league_id: str, week: int) -> List[Dict]:
        """Retrieve matchup data with error handling"""
        try:
            response = self.session.get(
                f"{self.BASE_URL}/league/{league_id}/matchups/{week}",
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            # Implement retry logic or fallback
            raise APIError(f"Failed to fetch matchups: {e}")
```

**Benefits:**
- Single source of truth for API access
- Easier testing with mock services
- Centralized error handling and retry logic
- Simplified caching implementation

---

## Caching Strategy

Fantasy data changes infrequently, making caching essential for performance optimization and reducing unnecessary API calls.

### What to Cache

| Data Type | Cache Duration | Rationale |
|-----------|----------------|-----------|
| Player Database | 24 hours | Updates once daily max |
| League Settings | Session/24 hours | Rarely changes mid-season |
| Rosters | 1 hour | Updates with transactions |
| Weekly Matchups | Until week ends | Static after games complete |
| User Profiles | 24 hours | Infrequently updated |
| Draft Results | Permanent | Historical, never changes |

### Implementation Example

```python
import time
from typing import Dict, Optional

class CachedSleeperAPI:
    def __init__(self):
        self._cache: Dict[str, tuple] = {}  # {key: (data, timestamp)}
        self._ttl_map = {
            'players': 86400,  # 24 hours
            'league': 86400,
            'rosters': 3600,   # 1 hour
            'matchups': 14400, # 4 hours
            'users': 86400
        }

    def _get_cached(self, key: str, category: str) -> Optional[Dict]:
        if key in self._cache:
            data, timestamp = self._cache[key]
            ttl = self._ttl_map[category]
            if time.time() - timestamp < ttl:
                return data
        return None

    def _set_cached(self, key: str, data: Dict, category: str):
        self._cache[key] = (data, time.time())

    def get_all_players(self) -> Dict:
        cached = self._get_cached('all_players', 'players')
        if cached:
            return cached

        # Fetch from API
        response = requests.get("https://api.sleeper.app/v1/players/nfl")
        data = response.json()
        self._set_cached('all_players', data, 'players')
        return data
```

**Cache Invalidation Strategies:**
- Time-based TTL (shown above)
- Event-driven (invalidate on transaction detection)
- Manual refresh endpoints for admin control

---

## Data Handling Challenges

### Large Dataset Processing

The `/players/nfl` endpoint returns ~5MB of JSON. Process this efficiently:

```python
import json
from typing import Generator

def stream_players(file_path: str) -> Generator[Dict, None, None]:
    """Stream player data without loading entire file to memory"""
    with open(file_path, 'r') as f:
        players = json.load(f)
        for player_id, player_data in players.items():
            yield player_id, player_data

def build_player_index(players_data: Dict) -> Dict[str, str]:
    """Create lightweight lookup index"""
    return {
        player_id: player['full_name']
        for player_id, player in players_data.items()
        if player.get('full_name')
    }
```

### Inconsistent Data Structures

Fantasy data may have structural variations. Always validate required fields:

```python
from typing import Optional

def safe_get_roster_points(roster: Dict) -> float:
    """Safely extract points with fallback"""
    try:
        return float(roster['settings']['fpts'])
    except (KeyError, TypeError, ValueError):
        return 0.0

def validate_matchup(matchup: Dict) -> bool:
    """Ensure matchup has required fields"""
    required = ['matchup_id', 'roster_id', 'points', 'starters']
    return all(key in matchup for key in required)
```

### Handling Null Values

Player data often contains null values for inactive players or free agents:

```python
def get_player_team(player: Dict) -> str:
    """Get player's team with FA fallback"""
    team = player.get('team')
    return team if team else "FA"

def is_player_active(player: Dict) -> bool:
    """Check if player is active"""
    status = player.get('status', 'Inactive')
    return status == 'Active'
```

---

## Real-Time Updates Strategy

The Sleeper API has no webhooks, requiring polling for real-time updates.

### Adaptive Polling

Adjust polling frequency based on time and context:

```python
import datetime

class AdaptivePoller:
    def __init__(self):
        self.game_days = [3, 6, 0]  # Thu, Sun, Mon (NFL)

    def get_poll_interval(self) -> int:
        """Return seconds between polls"""
        now = datetime.datetime.now()

        # During game days
        if now.weekday() in self.game_days:
            hour = now.hour
            # 1pm-11pm ET (game times)
            if 13 <= hour <= 23:
                return 60  # 1 minute
            else:
                return 300  # 5 minutes

        # Off-season or bye weeks
        return 3600  # 1 hour

    async def poll_matchups(self, league_id: str, week: int):
        """Continuously poll with adaptive intervals"""
        while True:
            interval = self.get_poll_interval()
            matchups = await fetch_matchups(league_id, week)
            await process_matchups(matchups)
            await asyncio.sleep(interval)
```

### Change Detection

Only process data that has actually changed:

```python
import hashlib
import json

class ChangeDetector:
    def __init__(self):
        self.checksums = {}

    def has_changed(self, key: str, data: Dict) -> bool:
        """Detect if data changed since last check"""
        data_str = json.dumps(data, sort_keys=True)
        checksum = hashlib.md5(data_str.encode()).hexdigest()

        if key not in self.checksums:
            self.checksums[key] = checksum
            return True

        if self.checksums[key] != checksum:
            self.checksums[key] = checksum
            return True

        return False

# Usage
detector = ChangeDetector()
matchups = get_matchups(league_id, week)

if detector.has_changed(f"matchups_{league_id}_{week}", matchups):
    # Process updated matchups
    process_matchups(matchups)
```

---

## Error Handling & Resilience

### Retry Logic with Exponential Backoff

```python
import time
from typing import Callable, Any

def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0
) -> Any:
    """Retry function with exponential backoff"""
    for attempt in range(max_retries):
        try:
            return func()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise

            delay = min(base_delay * (2 ** attempt), max_delay)
            print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            time.sleep(delay)

# Usage
def fetch_league():
    response = requests.get("https://api.sleeper.app/v1/league/987654321")
    response.raise_for_status()
    return response.json()

league_data = retry_with_backoff(fetch_league)
```

### Circuit Breaker Pattern

Prevent cascading failures by stopping requests after repeated failures:

```python
from enum import Enum
import time

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED

    def call(self, func: Callable) -> Any:
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.timeout:
                self.state = CircuitState.HALF_OPEN
            else:
                raise Exception("Circuit breaker is OPEN")

        try:
            result = func()
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise e

    def on_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED

    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
```

---

## Practical Use Cases

### 1. Analytics Dashboard

Build comprehensive league analytics:

```python
class LeagueAnalytics:
    def __init__(self, league_id: str):
        self.league = League(league_id)

    def get_power_rankings(self) -> List[Dict]:
        """Calculate power rankings based on points scored"""
        rosters = self.league.get_rosters()
        users = self.league.get_users()

        # Create user lookup
        user_map = {u['user_id']: u for u in users}

        # Sort by points
        ranked = sorted(
            rosters,
            key=lambda r: r['settings']['fpts'],
            reverse=True
        )

        return [
            {
                'rank': i + 1,
                'team': user_map[r['owner_id']]['display_name'],
                'points': r['settings']['fpts'],
                'record': f"{r['settings']['wins']}-{r['settings']['losses']}"
            }
            for i, r in enumerate(ranked)
        ]

    def analyze_trade_activity(self) -> Dict:
        """Analyze trading patterns"""
        trades = []
        for week in range(1, 18):
            transactions = self.league.get_transactions(week)
            trades.extend([t for t in transactions if t['type'] == 'trade'])

        return {
            'total_trades': len(trades),
            'trades_per_week': len(trades) / 17,
            'most_active_traders': self._get_active_traders(trades)
        }
```

### 2. Draft Assistant

Provide real-time draft recommendations:

```python
class DraftAssistant:
    def __init__(self, draft_id: str):
        self.draft_id = draft_id
        self.players = Players.get_all_players()

    def get_best_available(self, position: str, n: int = 10) -> List[Dict]:
        """Get top N available players at position"""
        draft = Draft(self.draft_id)
        picks = draft.get_picks()

        # Get drafted player IDs
        drafted = {pick['player_id'] for pick in picks}

        # Filter available players
        available = [
            p for pid, p in self.players.items()
            if p.get('position') == position and pid not in drafted
        ]

        # Sort by ADP or custom ranking
        return sorted(available, key=lambda p: p.get('adp', 999))[:n]
```

### 3. League Archive

Preserve historical data:

```python
import json
from datetime import datetime

class LeagueArchiver:
    def __init__(self, league_id: str):
        self.league_id = league_id
        self.league = League(league_id)

    def archive_season(self, season: str) -> str:
        """Save complete season data"""
        archive = {
            'metadata': {
                'league_id': self.league_id,
                'season': season,
                'archived_at': datetime.now().isoformat()
            },
            'league_settings': self.league.get_league(),
            'rosters': self.league.get_rosters(),
            'users': self.league.get_users(),
            'matchups': {},
            'transactions': {},
            'drafts': self.league.get_all_drafts()
        }

        # Archive all weeks
        for week in range(1, 18):
            archive['matchups'][str(week)] = self.league.get_matchups(week)
            archive['transactions'][str(week)] = self.league.get_transactions(week)

        # Save to file
        filename = f"sleeper_archive_{self.league_id}_{season}.json"
        with open(filename, 'w') as f:
            json.dump(archive, f, indent=2)

        return filename
```

---

## Rate Limiting Best Practices

### Client-Side Throttling

```python
import time
from collections import deque

class RateLimiter:
    def __init__(self, max_calls: int = 1000, window: int = 60):
        self.max_calls = max_calls
        self.window = window
        self.calls = deque()

    def wait_if_needed(self):
        """Block if rate limit would be exceeded"""
        now = time.time()

        # Remove calls outside window
        while self.calls and self.calls[0] < now - self.window:
            self.calls.popleft()

        # Wait if at limit
        if len(self.calls) >= self.max_calls:
            sleep_time = self.calls[0] + self.window - now
            if sleep_time > 0:
                time.sleep(sleep_time)
                self.wait_if_needed()  # Recursive check

        self.calls.append(now)

# Usage
limiter = RateLimiter(max_calls=900, window=60)  # Stay under 1000/min

for league_id in league_ids:
    limiter.wait_if_needed()
    data = fetch_league(league_id)
```

---

## Testing Strategies

### Mock API Responses

```python
from unittest.mock import Mock, patch
import pytest

@pytest.fixture
def mock_league_response():
    return {
        'league_id': '987654321',
        'name': 'Test League',
        'total_rosters': 12,
        'status': 'in_season',
        'season': '2025'
    }

def test_get_league(mock_league_response):
    with patch('requests.Session.get') as mock_get:
        mock_get.return_value.json.return_value = mock_league_response

        service = SleeperService()
        league = service.get_league('987654321')

        assert league['name'] == 'Test League'
        assert league['total_rosters'] == 12
```

### Integration Tests

```python
def test_real_api_call():
    """Test with actual API (use sparingly)"""
    # Use a known public league for testing
    league = League('987654321')

    try:
        data = league.get_league()
        assert 'league_id' in data
        assert 'name' in data
    except Exception as e:
        pytest.skip(f"API unavailable: {e}")
```

---

## Performance Optimization Summary

1. **Cache aggressively:** Player data (24h), league settings (24h), rosters (1h)
2. **Batch operations:** Fetch related data in parallel when possible
3. **Implement retry logic:** Exponential backoff for transient failures
4. **Use circuit breakers:** Prevent cascade failures
5. **Adaptive polling:** Higher frequency during games, lower during off-hours
6. **Change detection:** Only process data that has actually changed
7. **Rate limiting:** Client-side throttling to stay under 1000 calls/min
8. **Stream large datasets:** Don't load 5MB player file into memory repeatedly
