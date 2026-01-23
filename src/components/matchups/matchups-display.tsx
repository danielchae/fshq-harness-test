'use client';

import { AlertCircle, CalendarDays, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMatchups } from '@/hooks/use-matchups';
import { MatchupBlock } from './matchup-block';
import { WeekSelectorStrip } from './week-selector-strip';

interface MatchupsDisplayProps {
  leagueSlug: string;
  initialWeek?: number;
}

export function MatchupsDisplay({ leagueSlug, initialWeek }: MatchupsDisplayProps) {
  const {
    matchups,
    isLoading,
    error,
    currentWeek,
    selectedWeek,
    totalWeeks,
    setSelectedWeek,
    retry,
    seasonState,
    availableWeeks,
  } = useMatchups({
    leagueSlug,
    initialWeek,
  });

  // Sort matchups with featured first
  const sortedMatchups = [...matchups].sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Week Selector */}
      <WeekSelectorStrip
        totalWeeks={totalWeeks}
        currentWeek={currentWeek}
        selectedWeek={selectedWeek}
        onWeekSelect={setSelectedWeek}
        availableWeeks={availableWeeks.length > 0 ? availableWeeks : undefined}
        championshipWeek={seasonState?.championshipWeek}
        isSeasonComplete={seasonState?.isSeasonComplete}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center border rounded-lg border-dashed">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">Error loading matchups</p>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={retry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && matchups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center border rounded-lg border-dashed">
          <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <p className="text-lg font-medium text-muted-foreground">No matchups for Week {selectedWeek}</p>
            <p className="text-sm text-muted-foreground">
              {availableWeeks.length > 0
                ? 'Select a different week to view matchups.'
                : 'No matchup data available yet.'}
            </p>
          </div>
        </div>
      )}

      {/* Matchups Grid */}
      {!isLoading && !error && matchups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedMatchups.map((matchup) => (
            <MatchupBlock key={matchup.id} matchup={matchup} />
          ))}
        </div>
      )}
    </div>
  );
}
