'use client';

import { AlertCircle, RefreshCw, Trophy } from 'lucide-react';
import { use, useEffect } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { LeaderboardTable } from '@/components/leaderboard/leaderboard-table';
import { RoleFilter } from '@/components/leaderboard/role-filter';
import { ScopeToggle } from '@/components/leaderboard/scope-toggle';
import { UserStatsCard } from '@/components/leaderboard/user-stats-card';
import { WeekSelector } from '@/components/leaderboard/week-selector';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeaderboard } from '@/hooks/use-leaderboard';

interface LeaderboardPageProps {
  params: Promise<{ slug: string }>;
}

function LeaderboardContent({ slug }: { slug: string }) {
  const {
    standings,
    scope,
    roleFilter,
    currentWeek,
    weekNumber,
    seasonYear,
    leagueAverage,
    isLoading,
    error,
    refetch,
    setScope,
    setRoleFilter,
    setWeekNumber,
    seasonState,
    availableWeeks,
  } = useLeaderboard({ leagueSlug: slug });

  // When switching to weekly scope, initialize weekNumber to currentWeek if not set
  useEffect(() => {
    if (scope === 'weekly' && weekNumber === undefined && currentWeek > 0) {
      setWeekNumber(currentWeek);
    }
  }, [scope, weekNumber, currentWeek, setWeekNumber]);

  const getScopeTitle = () => {
    switch (scope) {
      case 'weekly':
        return `Week ${weekNumber ?? currentWeek} Standings`;
      case 'season':
        return seasonState?.isSeasonComplete
          ? `${seasonYear ?? 2025} Final Standings`
          : `${seasonYear ?? 2025} Season Standings`;
      case 'all-time':
        return 'All-Time Standings';
      default:
        return 'Leaderboard';
    }
  };

  const getRoleDescription = () => {
    switch (roleFilter) {
      case 'manager':
        return 'Showing only team managers';
      case 'fan':
        return 'Showing only fans';
      default:
        return 'Showing all members';
    }
  };

  const filterControls = (
    <>
      <ScopeToggle value={scope} onValueChange={setScope} />
      {scope === 'weekly' && (availableWeeks.length > 0 || currentWeek > 0) && (
        <WeekSelector
          value={weekNumber ?? currentWeek}
          currentWeek={currentWeek}
          onValueChange={setWeekNumber}
          availableWeeks={availableWeeks.length > 0 ? availableWeeks : undefined}
          championshipWeek={seasonState?.championshipWeek}
          isSeasonComplete={seasonState?.isSeasonComplete}
        />
      )}
      <RoleFilter value={roleFilter} onValueChange={setRoleFilter} />
    </>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <TableSkeleton rows={8} columns={5} showHeader={true} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Trophy} title="Leaderboard" />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center gap-4">
            <span>Failed to load leaderboard. Please try again.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state (no leaderboard data at season start)
  if (standings.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Trophy} title="Leaderboard" description={getRoleDescription()}>
          {filterControls}
        </PageHeader>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
            <p className="text-muted-foreground text-center">Leaderboard updates after Week 1</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Trophy}
        title={getScopeTitle()}
        description={`${getRoleDescription()} • League Avg: ${leagueAverage}%`}
      >
        {seasonState?.isSeasonComplete && scope === 'season' && (
          <Badge variant="secondary" className="gap-1">
            <Trophy className="h-3 w-3" />
            Final
          </Badge>
        )}
        {filterControls}
      </PageHeader>

      {/* User stats card - displays above the table */}
      <UserStatsCard leagueSlug={slug} />

      {/* Leaderboard table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Pick&apos;ems Standings
          </CardTitle>
          <CardDescription>
            Rankings based on correct pick predictions. Green accuracy indicates above league average.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardTable standings={standings} leagueAverage={leagueAverage} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeaderboardPage({ params }: LeaderboardPageProps) {
  const { slug } = use(params);

  return <LeaderboardContent slug={slug} />;
}
