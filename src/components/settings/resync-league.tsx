'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ResyncLeagueProps {
  leagueSlug: string;
  platform: 'sleeper' | 'espn' | 'yahoo';
  platformLeagueId?: string | null;
}

export function ResyncLeague({ leagueSlug, platform, platformLeagueId }: ResyncLeagueProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [resolvedPlatform, setResolvedPlatform] = useState(platform);
  const [resolvedPlatformLeagueId, setResolvedPlatformLeagueId] = useState(platformLeagueId ?? null);

  useEffect(() => {
    if (resolvedPlatformLeagueId || resolvedPlatform !== 'sleeper') {
      return;
    }

    const fetchLeague = async () => {
      try {
        const response = await fetch(`/api/leagues/${leagueSlug}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data?.platform) {
          setResolvedPlatform(data.platform);
        }
        if (data?.platformLeagueId) {
          setResolvedPlatformLeagueId(data.platformLeagueId);
        }
      } catch {
        // Ignore background fetch failures
      }
    };

    fetchLeague();
  }, [leagueSlug, resolvedPlatform, resolvedPlatformLeagueId]);

  const canSync = resolvedPlatform === 'sleeper' && Boolean(resolvedPlatformLeagueId);
  const helperText = canSync
    ? 'This may take a minute to complete. You can keep browsing while it runs.'
    : resolvedPlatform !== 'sleeper'
      ? 'Resync is currently available for Sleeper leagues only.'
      : 'This league is not connected to Sleeper yet.';

  const handleResync = async () => {
    if (!resolvedPlatformLeagueId || isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeperLeagueId: resolvedPlatformLeagueId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start sync');
      }

      const data = await response.json().catch(() => null);
      toast.success('Resync started', {
        description: data?.message || 'Fetching the latest Sleeper data for this league.',
      });
    } catch {
      toast.error('Resync failed', {
        description: 'Unable to start a Sleeper resync right now.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card data-testid="resync-league">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Resync League Data
        </CardTitle>
        <CardDescription>Pull the latest teams, matchups, and transactions from Sleeper.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">{helperText}</div>
        <Button onClick={handleResync} disabled={!canSync || isSyncing}>
          <RefreshCw className={isSyncing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          {isSyncing ? 'Resyncing...' : 'Resync Now'}
        </Button>
      </CardContent>
    </Card>
  );
}
