'use client';

import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, Target, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePickems } from '@/hooks/use-pickems';
import { LockCountdown } from './LockCountdown';
import { MatchupPickCard } from './MatchupPickCard';
import { PickResultCard } from './PickResultCard';
import { PicksSummary } from './PicksSummary';
import { ResultsHeader } from './ResultsHeader';

interface PickemsContentProps {
  leagueSlug: string;
}

export function PickemsContent({ leagueSlug }: PickemsContentProps) {
  const {
    matchups,
    currentWeek,
    lockTimeGlobal,
    selections,
    isLoading,
    error,
    selectTeam,
    savePicks,
    isSaving,
    refetch,
    weeklyScore,
    hasSubmittedPicks,
    isWeekComplete,
    seasonState,
    selectedWeek,
    setSelectedWeek,
    availableWeeks,
  } = usePickems({ leagueSlug });

  // Global API error state for displaying errors from direct API calls
  const [apiError, setApiError] = useState<string | null>(null);

  // Listen for failed pickems API calls (for handling direct API manipulations)
  useEffect(() => {
    const handleApiError = (event: Event) => {
      const customEvent = event as CustomEvent<{ error: string }>;
      setApiError(customEvent.detail?.error || 'An error occurred');
    };

    // Listen for custom pickems error events
    window.addEventListener('pickems-api-error', handleApiError);

    // Intercept fetch to catch direct API errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : '';

      // Check if this is a pickems API call that failed
      if (url.includes('/api/pickems') && !response.ok) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          if (data.error) {
            // Use queueMicrotask to avoid setState during render
            queueMicrotask(() => {
              setApiError(data.error);
            });
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
      return response;
    };

    return () => {
      window.removeEventListener('pickems-api-error', handleApiError);
      window.fetch = originalFetch;
    };
  }, []);

  const handleSavePicks = async () => {
    setApiError(null); // Clear any existing API error
    const result = await savePicks();

    if (result.success) {
      toast.success(result.message, {
        description: 'Your picks have been recorded',
      });
    } else {
      toast.error('Failed to save picks', {
        description: result.message,
      });
      setApiError(result.message);
    }
  };

  const dismissApiError = () => {
    setApiError(null);
  };

  // Week navigation component
  const WeekNavigation = () => {
    if (availableWeeks.length === 0) return null;

    const canGoPrev = selectedWeek > Math.min(...availableWeeks);
    const canGoNext = selectedWeek < Math.max(...availableWeeks);

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => canGoPrev && setSelectedWeek(selectedWeek - 1)}
          disabled={!canGoPrev}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(parseInt(v, 10))}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableWeeks.map((week) => (
              <SelectItem key={week} value={String(week)}>
                Week {week}
                {week === seasonState?.championshipWeek && ' (Finals)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => canGoNext && setSelectedWeek(selectedWeek + 1)}
          disabled={!canGoNext}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  // Season status badge
  const SeasonStatusBadge = () => {
    if (!seasonState) return null;

    if (seasonState.isSeasonComplete) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Trophy className="h-3 w-3" />
          Season Complete
        </Badge>
      );
    }

    if (seasonState.status === 'preseason') {
      return (
        <Badge variant="outline" className="gap-1">
          <Calendar className="h-3 w-3" />
          Preseason
        </Badge>
      );
    }

    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading pick&apos;ems...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="mt-4 text-lg font-medium">Error loading pick&apos;ems</p>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No picks submitted for this week (but week has no matchups)
  if (hasSubmittedPicks === false && matchups.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Target}
          title="Pick'ems"
          description={seasonState?.statusMessage || `Week ${currentWeek}`}
        >
          <SeasonStatusBadge />
          <WeekNavigation />
        </PageHeader>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No matchups for Week {selectedWeek}</p>
            <p className="text-muted-foreground">
              {availableWeeks.length > 0
                ? 'Use the week selector to browse other weeks'
                : 'No matchup data available yet'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state (no matchups at all in the league)
  if (matchups.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Target}
          title="Pick'ems"
          description={seasonState?.statusMessage || `Week ${currentWeek}`}
        >
          <SeasonStatusBadge />
          {availableWeeks.length > 0 && <WeekNavigation />}
        </PageHeader>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No pick&apos;em matchups for Week {selectedWeek}</p>
            <p className="text-muted-foreground">
              {seasonState?.isSeasonComplete
                ? 'The season has ended. Browse previous weeks to see your results.'
                : 'Check back later for upcoming matchups'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if this is a results view (week complete with graded matchups, or season is complete)
  const isResultsView = isWeekComplete || seasonState?.isSeasonComplete || matchups.some((m) => m.isComplete && m.isCorrect !== undefined);

  // Results view - show graded picks
  if (isResultsView) {
    return (
      <div className="space-y-6">
        {/* API Error Alert */}
        {apiError && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{apiError}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={dismissApiError}>
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Header with week navigation */}
        <PageHeader
          icon={Target}
          title={seasonState?.isSeasonComplete ? 'Pick\'ems History' : 'Pick\'ems Results'}
          description={`Week ${selectedWeek}${selectedWeek === seasonState?.championshipWeek ? ' Finals' : ''}`}
        >
          <SeasonStatusBadge />
          <WeekNavigation />
        </PageHeader>

        {/* Results Header with weekly score (if user had picks) */}
        {weeklyScore && <ResultsHeader weeklyScore={weeklyScore} weekNumber={selectedWeek} />}

        {/* No picks for this week */}
        {!weeklyScore && hasSubmittedPicks === false && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">You didn&apos;t submit picks for Week {selectedWeek}</p>
            </CardContent>
          </Card>
        )}

        {/* Graded pick cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matchups.map((matchup) => (
            <PickResultCard key={matchup.id} matchup={matchup} />
          ))}
        </div>
      </div>
    );
  }

  // Calculate pick counts for unlocked matchups only
  const unlockedMatchups = matchups.filter((m) => !m.isLocked);
  const pickedCount = unlockedMatchups.filter((m) => selections.has(m.id)).length;
  const totalUnlocked = unlockedMatchups.length;

  // Check if picks can be made
  const canMakePicks = seasonState?.canMakePicks !== false && totalUnlocked > 0;

  // Standard pick'ems submission view
  return (
    <div className="space-y-6">
      {/* API Error Alert */}
      {apiError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{apiError}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={dismissApiError}>
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header with controls */}
      <PageHeader icon={Target} title="Pick'ems" description={`Week ${selectedWeek}`}>
        <SeasonStatusBadge />
        <WeekNavigation />
        {lockTimeGlobal && canMakePicks && <LockCountdown lockTime={lockTimeGlobal} />}
        {canMakePicks && <PicksSummary pickedCount={pickedCount} totalMatchups={totalUnlocked} />}
      </PageHeader>

      {/* Matchup cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {matchups.map((matchup) => (
          <MatchupPickCard
            key={matchup.id}
            matchup={matchup}
            selectedTeamId={selections.get(matchup.id)}
            onSelectTeam={canMakePicks ? selectTeam : undefined}
          />
        ))}
      </div>

      {/* Save button - only show if picks can be made */}
      {canMakePicks && (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleSavePicks}
            disabled={isSaving || pickedCount === 0}
            className="min-w-[200px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Picks ({pickedCount}/{totalUnlocked})
              </>
            )}
          </Button>
        </div>
      )}

      {/* Info message when picks are locked but viewing current week */}
      {!canMakePicks && totalUnlocked === 0 && matchups.length > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <p className="text-muted-foreground text-center">
              All matchups for Week {selectedWeek} are locked. Check back next week for new picks.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
