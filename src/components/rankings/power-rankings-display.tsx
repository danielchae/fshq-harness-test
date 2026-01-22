'use client';

import { AlertCircle, BarChart3, LineChart, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { RankingsTrajectoryChart } from '@/components/rankings/rankings-trajectory-chart';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import type { PowerRankingsData, TeamRanking } from '@/data/power-rankings/get-power-rankings';

interface PowerRankingsDisplayProps {
  leagueSlug: string;
  initialWeek?: number;
  availableWeeks?: number[];
}

export function PowerRankingsDisplay({ leagueSlug, initialWeek = 3, availableWeeks }: PowerRankingsDisplayProps) {
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | undefined>();
  const [showTrajectory, setShowTrajectory] = useState(false);

  // Default available weeks if not provided
  const weeks = availableWeeks || Array.from({ length: 17 }, (_, i) => i + 1);

  const fetchRankings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/power-rankings?leagueSlug=${leagueSlug}&weekNumber=${selectedWeek}`);

      if (!response.ok) {
        throw new Error('Failed to fetch rankings');
      }

      const data: PowerRankingsData = await response.json();

      // Only show published rankings
      if (data.status === 'published') {
        setRankings(data.rankings);
        setPublishedAt(data.publishedAt);
      } else {
        // For draft status, also show rankings (mock behavior)
        // In production, backend would filter unpublished
        setRankings(data.rankings);
        setPublishedAt(data.lastSaved);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load rankings');
      setRankings([]);
    } finally {
      setIsLoading(false);
    }
  }, [leagueSlug, selectedWeek]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const handleWeekChange = (value: string) => {
    setSelectedWeek(parseInt(value, 10));
  };

  const handleRetry = () => {
    fetchRankings();
  };

  const getRankChange = (ranking: TeamRanking) => {
    if (!ranking.previousRank) return null;
    const change = ranking.previousRank - ranking.rank;
    if (change > 0) return <span className="text-green-500 text-sm font-medium">↑{change}</span>;
    if (change < 0) return <span className="text-red-500 text-sm font-medium">↓{Math.abs(change)}</span>;
    return <span className="text-muted-foreground text-sm">—</span>;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-md" />
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-full mt-3" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <h3 className="font-semibold">Week {selectedWeek} Power Rankings</h3>
          </div>
          <Select value={selectedWeek.toString()} onValueChange={handleWeekChange}>
            <SelectTrigger data-testid="week-selector" className="w-32" aria-label="Select week">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  Week {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="font-semibold text-lg">Unable to load rankings</h3>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
            <Button onClick={handleRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Empty state
  if (rankings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <h3 className="font-semibold">Week {selectedWeek} Power Rankings</h3>
          </div>
          <Select value={selectedWeek.toString()} onValueChange={handleWeekChange}>
            <SelectTrigger data-testid="week-selector" className="w-32" aria-label="Select week">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  Week {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <BarChart3 className="h-12 w-12 text-muted-foreground" />
            <h3 className="font-semibold text-lg">No Rankings Available</h3>
            <p className="text-muted-foreground text-sm">Rankings not yet published for this week</p>
          </div>
        </Card>
      </div>
    );
  }

  // Normal display
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h3 className="font-semibold">Week {selectedWeek} Power Rankings</h3>
          {publishedAt && (
            <span className="text-xs text-muted-foreground">
              Published {new Date(publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showTrajectory ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowTrajectory(!showTrajectory)}
            data-testid="trajectory-toggle"
          >
            <LineChart className="h-4 w-4 mr-2" />
            {showTrajectory ? 'Hide Trajectory' : 'View Trajectory'}
          </Button>
          <Select value={selectedWeek.toString()} onValueChange={handleWeekChange}>
            <SelectTrigger data-testid="week-selector" className="w-32" aria-label="Select week">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  Week {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table data-testid="rankings-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="w-24">Record</TableHead>
              <TableHead>Commentary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankings.map((ranking) => {
              const recordText = `${ranking.record.wins}-${ranking.record.losses}${ranking.record.ties > 0 ? `-${ranking.record.ties}` : ''}`;

              return (
                <TableRow key={ranking.id} data-testid="ranking-row">
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span
                        data-testid="rank-number"
                        data-rank={ranking.rank}
                        className="text-xl font-bold text-primary"
                      >
                        {ranking.rank}
                      </span>
                      {getRankChange(ranking)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10" data-testid="team-logo">
                        <AvatarImage src={ranking.avatarUrl} alt={`${ranking.teamName} logo`} />
                        <AvatarFallback>{ranking.teamName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span data-testid="team-name" className="font-semibold">
                          {ranking.teamName}
                        </span>
                        <span className="text-sm text-muted-foreground">{ranking.ownerUsername}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{recordText}</TableCell>
                  <TableCell>
                    <p data-testid="commentary" className="text-sm text-muted-foreground italic line-clamp-2">
                      {ranking.commentary ? `"${ranking.commentary}"` : '—'}
                    </p>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {rankings.map((ranking) => {
          const recordText = `${ranking.record.wins}-${ranking.record.losses}${ranking.record.ties > 0 ? `-${ranking.record.ties}` : ''}`;

          return (
            <Card key={ranking.id} data-testid="ranking-card" className="p-4">
              <div className="flex items-start gap-4">
                {/* Rank */}
                <div className="flex flex-col items-center gap-1 min-w-[50px]">
                  <span data-testid="rank-number" data-rank={ranking.rank} className="text-3xl font-bold text-primary">
                    {ranking.rank}
                  </span>
                  {getRankChange(ranking)}
                </div>

                {/* Team info */}
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-12 w-12" data-testid="team-logo">
                    <AvatarImage src={ranking.avatarUrl} alt={`${ranking.teamName} logo`} />
                    <AvatarFallback>{ranking.teamName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span data-testid="team-name" className="font-semibold text-lg">
                      {ranking.teamName}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {ranking.ownerUsername} • {recordText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Commentary */}
              {ranking.commentary && (
                <div className="mt-3 pt-3 border-t">
                  <p
                    data-testid="commentary"
                    data-commentary
                    className="commentary text-sm text-muted-foreground italic"
                  >
                    &quot;{ranking.commentary}&quot;
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Trajectory Chart - shown when toggle is active */}
      {showTrajectory && <RankingsTrajectoryChart leagueSlug={leagueSlug} />}
    </div>
  );
}
