'use client';

import { AlertCircle, History, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { AllTimeRecords } from '@/components/history/all-time-records';
import { SeasonCard } from '@/components/history/season-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { LeagueHistoryResponse } from '@/types/history';

interface SeasonArchiveListProps {
  leagueSlug: string;
}

export function SeasonArchiveList({ leagueSlug }: SeasonArchiveListProps) {
  const [data, setData] = useState<LeagueHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/history`);

      if (!response.ok) {
        throw new Error('Failed to fetch league history');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="error-message" className="flex flex-col items-center justify-center gap-4 py-12">
        <AlertCircle className="text-destructive h-12 w-12" />
        <p className="text-muted-foreground text-center">{error}</p>
        <Button onClick={fetchHistory} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.seasons.length === 0) {
    return (
      <div data-testid="empty-state" className="flex flex-col items-center justify-center gap-4 py-12">
        <History className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground text-center">League history will appear after first completed season</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* All-Time Records Section */}
      <AllTimeRecords records={data.allTimeRecords} />

      {/* Season Archive Cards */}
      <div>
        <h3 className="mb-5 text-lg font-semibold">Season Archives</h3>
        <div className="space-y-6">
          {data.seasons.map((season) => (
            <SeasonCard key={season.id} season={season} leagueSlug={leagueSlug} />
          ))}
        </div>
      </div>
    </div>
  );
}
