'use client';

import { ArrowDown, ArrowUp, Target, Trophy, Users } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserStats } from '@/hooks/use-user-stats';

interface UserStatsCardProps {
  leagueSlug: string;
}

export function UserStatsCard({ leagueSlug }: UserStatsCardProps) {
  const { stats, isLoading, error } = useUserStats({ leagueSlug });

  // Loading state
  if (isLoading) {
    return (
      <Card data-testid="user-stats-card" data-user-stats>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="flex gap-6">
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-12 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state - silently fail, don't show card
  if (error || !stats) {
    return null;
  }

  // No picks state
  if (stats.hasNoPicks) {
    return (
      <Card data-testid="user-stats-card" data-user-stats>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
            <Target className="h-5 w-5" />
            <span>No picks yet - make your first pick!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { record, accuracy, leagueAverage, isAboveAverage, rank } = stats;
  const recordString = `${record.wins}-${record.losses}`;
  const accuracyDiff = Math.abs(accuracy - leagueAverage).toFixed(1);

  return (
    <Card data-testid="user-stats-card" data-user-stats>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Title */}
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Your Pick&apos;ems Stats</span>
          </div>

          {/* Stats row - responsive layout */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Record */}
            <div className="flex flex-col items-center" data-stat="record">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Record</span>
              <span className="text-lg font-bold" data-testid="user-record" data-record>
                {recordString}
              </span>
            </div>

            {/* Accuracy */}
            <div className="flex flex-col items-center" data-stat="accuracy">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Accuracy</span>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold" data-testid="accuracy-percentage" data-accuracy>
                  {accuracy.toFixed(1)}%
                </span>
                {isAboveAverage ? (
                  <ArrowUp
                    className="h-4 w-4 text-green-500"
                    data-trend="up"
                    data-testid="trend-up"
                    data-icon="arrow-up"
                  />
                ) : (
                  <ArrowDown
                    className="h-4 w-4 text-red-500"
                    data-trend="down"
                    data-testid="trend-down"
                    data-icon="arrow-down"
                  />
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {isAboveAverage ? '+' : '-'}
                {accuracyDiff}% vs avg
              </span>
            </div>

            {/* Rank */}
            {rank && (
              <div className="flex flex-col items-center" data-stat="rank">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Rank</span>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-bold">#{rank.overall}</span>
                </div>
                <span className="text-xs text-muted-foreground">of {rank.totalParticipants}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
