'use client';

import { TrendingUp, Trophy } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { UserStats } from '@/types/profile';

interface StatsOverviewProps {
  stats: UserStats;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const formatRecord = (record: { wins: number; losses: number; ties: number }) => {
    return `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}`;
  };

  const formatPercentage = (percentage: number) => {
    return `${(percentage * 100).toFixed(1)}%`;
  };

  return (
    <Card data-testid="stats-overview">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Pick&apos;ems Record
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Season Record */}
          <div className="space-y-2" data-testid="season-record">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-medium">This Season</h3>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold">{formatRecord(stats.seasonRecord)}</p>
              <p className="text-sm text-muted-foreground">
                Win Rate: {formatPercentage(stats.seasonRecord.percentage)}
              </p>
            </div>
          </div>

          {/* All-Time Record */}
          <div className="space-y-2" data-testid="all-time-record">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h3 className="font-medium">All-Time</h3>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold">{formatRecord(stats.allTimeRecord)}</p>
              <p className="text-sm text-muted-foreground">
                Win Rate: {formatPercentage(stats.allTimeRecord.percentage)} • {stats.allTimeRecord.seasons} seasons
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
