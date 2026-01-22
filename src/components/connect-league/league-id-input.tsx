'use client';

import { AlertCircle, Loader2, Trophy } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { validateSleeperUsername } from '@/data/sleeper/lookup-leagues';

import type { SleeperLeague } from '@/types/sleeper';

interface LeagueIdInputProps {
  onLeagueSelect?: (league: SleeperLeague) => void;
  initialUsername?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export function LeagueIdInput({ onLeagueSelect, initialUsername = '' }: LeagueIdInputProps) {
  const [username, setUsername] = useState(initialUsername);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    // Clear validation error while typing
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleBlur = () => {
    // Validate on blur
    const error = validateSleeperUsername(username);
    setValidationError(error);
  };

  const fetchLeagues = useCallback(async () => {
    // Validate first
    const error = validateSleeperUsername(username);
    if (error) {
      setValidationError(error);
      return;
    }

    setStatus('loading');
    setFetchError(null);
    setLeagues([]);

    try {
      const response = await fetch(`/api/sleeper/leagues?username=${encodeURIComponent(username)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch leagues');
      }

      const data = await response.json();

      if (data.leagues && data.leagues.length > 0) {
        setLeagues(data.leagues);
        setStatus('success');
      } else {
        setStatus('empty');
      }
    } catch (err) {
      console.error('Error fetching leagues:', err);
      setFetchError('Unable to connect to Sleeper. Please check your connection and try again.');
      setStatus('error');
    }
  }, [username]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeagues();
  };

  const handleRetry = () => {
    fetchLeagues();
  };

  const handleLeagueClick = (league: SleeperLeague) => {
    setSelectedLeague(league.league_id || league.id || null);
    onLeagueSelect?.(league);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            Connect Your League
          </CardTitle>
          <CardDescription>Enter your Sleeper username to find and connect your fantasy leagues.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="sleeper-username" className="text-sm font-medium leading-none">
                Sleeper Username
              </label>
              <Input
                id="sleeper-username"
                name="username"
                type="text"
                placeholder="Enter your Sleeper username"
                value={username}
                onChange={handleInputChange}
                onBlur={handleBlur}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? 'username-error' : undefined}
                disabled={status === 'loading'}
              />
              {validationError && (
                <p
                  id="username-error"
                  role="alert"
                  data-testid="validation-error"
                  className="text-sm text-destructive flex items-center gap-1"
                >
                  <AlertCircle className="size-3" />
                  {validationError}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={status === 'loading'}>
              {status === 'loading' ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-testid="loading-spinner" role="status" />
                  Looking up leagues...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading state with visible spinner */}
      {status === 'loading' && (
        <div className="flex justify-center">
          <div data-testid="loading-spinner" role="status" className="spinner">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="sr-only">Loading leagues...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && fetchError && (
        <Alert variant="destructive" data-testid="error-message">
          <AlertCircle className="size-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{fetchError}</span>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {status === 'empty' && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>No leagues found for this username</AlertDescription>
        </Alert>
      )}

      {/* League list */}
      {status === 'success' && leagues.length > 0 && (
        <div data-testid="league-list" className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Select a league to connect</h3>
          {leagues.map((league) => (
            <Card
              key={league.league_id || league.id}
              data-testid="league-card"
              className={`cursor-pointer transition-colors hover:border-primary ${
                selectedLeague === (league.league_id || league.id) ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => handleLeagueClick(league)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  {league.avatar ? (
                    <img
                      src={
                        league.avatar.startsWith('http')
                          ? league.avatar
                          : `https://sleepercdn.com/avatars/${league.avatar}`
                      }
                      alt={league.name}
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                      <Trophy className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{league.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {league.total_rosters || league.team_count} teams • {league.season} Season
                    </p>
                  </div>
                </div>
                <Button
                  variant={selectedLeague === (league.league_id || league.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLeagueClick(league);
                  }}
                >
                  {selectedLeague === (league.league_id || league.id) ? 'Selected' : 'Select'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
