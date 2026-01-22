'use client';

import { LineChart, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import type { RankingsHistoryData, TeamRankingHistory } from '@/data/power-rankings/get-rankings-history';

interface RankingsTrajectoryChartProps {
  leagueSlug: string;
}

interface ChartDataPoint {
  week: string;
  weekNumber: number;
  [teamId: string]: string | number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    dataKey: string;
    value: number;
    color: string;
    payload: ChartDataPoint;
  }[];
  label?: string;
  teamData: Map<string, TeamRankingHistory>;
}

function CustomTooltip({ active, payload, label, teamData }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div role="tooltip" className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[150px]">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => {
          const team = teamData.get(entry.dataKey);
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground truncate max-w-[100px]">{team?.teamName || entry.dataKey}</span>
              </div>
              <span className="font-medium">#{entry.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RankingsTrajectoryChart({ leagueSlug }: RankingsTrajectoryChartProps) {
  const [historyData, setHistoryData] = useState<RankingsHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenTeams, setHiddenTeams] = useState<Set<string>>(new Set());

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/rankings/history?leagueSlug=${leagueSlug}`);

      if (!response.ok) {
        throw new Error('Failed to fetch rankings history');
      }

      const data: RankingsHistoryData = await response.json();
      setHistoryData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load rankings history');
      setHistoryData(null);
    } finally {
      setIsLoading(false);
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleTeamVisibility = (teamId: string) => {
    setHiddenTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rankings Trajectory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <LineChart className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check for empty/insufficient history
  if (!historyData || historyData.history.length === 0 || historyData.totalWeeks < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rankings Trajectory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <LineChart className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Trajectory available after Week 2</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build chart data
  const teamDataMap = new Map<string, TeamRankingHistory>(historyData.history.map((team) => [team.teamId, team]));

  // Get all unique weeks from the history
  const allWeeks = new Set<number>();
  historyData.history.forEach((team) => {
    team.history.forEach((h) => allWeeks.add(h.week));
  });
  const sortedWeeks = Array.from(allWeeks).sort((a, b) => a - b);

  // Transform data for Recharts
  const chartData: ChartDataPoint[] = sortedWeeks.map((weekNum) => {
    const dataPoint: ChartDataPoint = {
      week: `Week ${weekNum}`,
      weekNumber: weekNum,
    };

    historyData.history.forEach((team) => {
      const weekData = team.history.find((h) => h.week === weekNum);
      if (weekData) {
        dataPoint[team.teamId] = weekData.rank;
      }
    });

    return dataPoint;
  });

  // Calculate chart dimensions for mobile
  const minChartWidth = Math.max(400, sortedWeeks.length * 80);
  const totalTeams = historyData.history.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Rankings Trajectory
        </CardTitle>
        <CardDescription>Track how teams have moved in the rankings across the season</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Chart Container with horizontal scroll for mobile */}
        <div data-testid="trajectory-chart-container" className="overflow-x-auto" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: `${minChartWidth}px` }}>
            <div data-testid="trajectory-chart" className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    reversed
                    domain={[1, totalTeams]}
                    ticks={Array.from({ length: totalTeams }, (_, i) => i + 1)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                    label={{
                      value: 'Rank',
                      angle: -90,
                      position: 'insideLeft',
                      className: 'fill-muted-foreground',
                      style: { textAnchor: 'middle' },
                    }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip teamData={teamDataMap} active={undefined} payload={undefined} label={undefined} />
                    }
                  />
                  {historyData.history.map((team) => (
                    <Line
                      key={team.teamId}
                      type="monotone"
                      dataKey={team.teamId}
                      stroke={team.color}
                      strokeWidth={2}
                      dot={{ r: 4, fill: team.color, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: team.color, strokeWidth: 2, stroke: '#fff' }}
                      hide={hiddenTeams.has(team.teamId)}
                      connectNulls
                    />
                  ))}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Interactive Legend */}
        <div className="legend mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-2 justify-center">
            {historyData.history.map((team) => {
              const isHidden = hiddenTeams.has(team.teamId);
              return (
                <button
                  key={team.teamId}
                  role="button"
                  onClick={() => toggleTeamVisibility(team.teamId)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all ${
                    isHidden
                      ? 'bg-muted text-muted-foreground border-muted'
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full transition-opacity ${isHidden ? 'opacity-30' : 'opacity-100'}`}
                    style={{ backgroundColor: team.color }}
                  />
                  <span className={isHidden ? 'line-through' : ''}>{team.teamName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
