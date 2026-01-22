'use client';

import { AlertCircle, Inbox, Loader2, RefreshCw, Target, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  // No picks submitted for completed week
  if (hasSubmittedPicks === false && matchups.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Target} title={`Pick'ems - Week ${currentWeek}`} description="Predict matchup winners to climb the leaderboard" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No picks submitted for this week</p>
            <p className="text-muted-foreground">You didn&apos;t submit any picks for this week</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state (no matchups at all)
  if (matchups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Inbox className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">No pick&apos;em matchups this week</p>
          <p className="text-muted-foreground">Check back later for upcoming matchups</p>
        </CardContent>
      </Card>
    );
  }

  // Check if this is a results view (week complete with graded matchups)
  const isResultsView = isWeekComplete || matchups.some((m) => m.isComplete && m.isCorrect !== undefined);

  // Results view - show graded picks
  if (isResultsView && weeklyScore) {
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

        {/* Results Header with weekly score */}
        <ResultsHeader weeklyScore={weeklyScore} weekNumber={currentWeek} />

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
      <PageHeader icon={Target} title="Pick'ems" description={`Week ${currentWeek}`}>
        {lockTimeGlobal && <LockCountdown lockTime={lockTimeGlobal} />}
        <PicksSummary pickedCount={pickedCount} totalMatchups={totalUnlocked} />
      </PageHeader>

      {/* Matchup cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {matchups.map((matchup) => (
          <MatchupPickCard
            key={matchup.id}
            matchup={matchup}
            selectedTeamId={selections.get(matchup.id)}
            onSelectTeam={selectTeam}
          />
        ))}
      </div>

      {/* Save button */}
      {totalUnlocked > 0 && (
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
    </div>
  );
}
