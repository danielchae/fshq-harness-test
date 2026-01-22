'use client';

import { AlertCircle, ArrowLeft, Crown, Medal, RefreshCw, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import type { SeasonSummary } from '@/types/history';
import type { Route } from 'next';

interface SeasonDetailProps {
  leagueSlug: string;
  year: number;
}

export function SeasonDetail({ leagueSlug, year }: SeasonDetailProps) {
  const [season, setSeason] = useState<SeasonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeason = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/history/${year}`);

      if (!response.ok) {
        throw new Error('Failed to fetch season details');
      }

      const result = await response.json();
      setSeason(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [leagueSlug, year]);

  useEffect(() => {
    fetchSeason();
  }, [fetchSeason]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPlayoffResultBadge = (result?: string) => {
    switch (result) {
      case 'champion':
        return <Badge className="bg-yellow-500">Champion</Badge>;
      case 'runner-up':
        return <Badge variant="secondary">Runner-up</Badge>;
      case 'third':
        return <Badge variant="outline">3rd Place</Badge>;
      case 'semifinalist':
        return <Badge variant="outline">Semifinalist</Badge>;
      case 'quarterfinalist':
        return <Badge variant="outline">Quarterfinalist</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <AlertCircle className="text-destructive h-12 w-12" />
        <p className="text-muted-foreground text-center">{error}</p>
        <Button onClick={fetchSeason} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <AlertCircle className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground text-center">Season not found</p>
        <Link href={`/leagues/${leagueSlug}/history` as Route}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to History
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="season-detail" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/leagues/${leagueSlug}/history` as Route}
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </Link>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Trophy className="h-6 w-6 text-yellow-500" />
            {season.year} Season
          </h2>
          <p className="text-muted-foreground">
            {season.leagueName} • {season.format} • {season.teamCount} teams
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{season.format}</Badge>
          {season.completed && <Badge>Completed</Badge>}
        </div>
      </div>

      {/* Champion and Runner-up Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Champion Card */}
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <Crown className="h-5 w-5" />
              League Champion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={season.champion.avatarUrl} alt={season.champion.teamName} />
                <AvatarFallback>{getInitials(season.champion.teamName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-bold">{season.champion.teamName}</p>
                <p className="text-muted-foreground">{season.champion.managerName}</p>
                <p className="mt-1">
                  <span className="font-medium">{season.champion.record}</span>
                  <span className="text-muted-foreground"> • </span>
                  <span>{season.champion.totalPoints.toFixed(1)} pts</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Runner-up Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-slate-400" />
              Runner-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={season.runnerUp.avatarUrl} alt={season.runnerUp.teamName} />
                <AvatarFallback>{getInitials(season.runnerUp.teamName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-bold">{season.runnerUp.teamName}</p>
                <p className="text-muted-foreground">{season.runnerUp.managerName}</p>
                <p className="mt-1">
                  <span className="font-medium">{season.runnerUp.record}</span>
                  <span className="text-muted-foreground"> • </span>
                  <span>{season.runnerUp.totalPoints.toFixed(1)} pts</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Championship Game */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Championship Game (Week {season.championshipScore.week})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <Avatar className="mx-auto h-12 w-12">
                <AvatarImage src={season.champion.avatarUrl} alt={season.champion.teamName} />
                <AvatarFallback>{getInitials(season.champion.teamName)}</AvatarFallback>
              </Avatar>
              <p className="mt-2 text-sm font-medium">{season.champion.teamName}</p>
              <p className="text-2xl font-bold text-green-600">{season.championshipScore.championPoints}</p>
            </div>
            <div className="text-muted-foreground text-2xl font-bold">vs</div>
            <div className="text-center">
              <Avatar className="mx-auto h-12 w-12">
                <AvatarImage src={season.runnerUp.avatarUrl} alt={season.runnerUp.teamName} />
                <AvatarFallback>{getInitials(season.runnerUp.teamName)}</AvatarFallback>
              </Avatar>
              <p className="mt-2 text-sm font-medium">{season.runnerUp.teamName}</p>
              <p className="text-2xl font-bold">{season.championshipScore.runnerUpPoints}</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            Margin of Victory:{' '}
            {(season.championshipScore.championPoints - season.championshipScore.runnerUpPoints).toFixed(1)} points
          </p>
        </CardContent>
      </Card>

      {/* Season Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Season Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-muted-foreground text-sm">Total Points Scored</p>
              <p className="text-2xl font-bold">{season.stats.totalPointsScored.toLocaleString()}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-muted-foreground text-sm">Highest Scoring Week</p>
              <p className="text-2xl font-bold">{season.stats.highestScoringWeek.points}</p>
              <p className="text-muted-foreground text-xs">
                {season.stats.highestScoringWeek.teamName} (Week {season.stats.highestScoringWeek.week})
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-muted-foreground text-sm">Avg Points/Game</p>
              <p className="text-2xl font-bold">{season.stats.averagePointsPerGame.toFixed(1)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-muted-foreground text-sm">Playoff Teams</p>
              <p className="text-2xl font-bold">{season.stats.playoffTeams}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Standings */}
      <Card>
        <CardHeader>
          <CardTitle>Final Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Record</TableHead>
                <TableHead className="text-right">PF</TableHead>
                <TableHead className="text-right">PA</TableHead>
                <TableHead className="text-right">Playoff Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {season.standings.map((standing) => (
                <TableRow key={standing.teamId}>
                  <TableCell className="font-medium">{standing.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={standing.avatarUrl} alt={standing.teamName} />
                        <AvatarFallback className="text-xs">{getInitials(standing.teamName)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{standing.teamName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{standing.managerName}</TableCell>
                  <TableCell className="text-right">
                    {standing.wins}-{standing.losses}
                    {standing.ties ? `-${standing.ties}` : ''}
                  </TableCell>
                  <TableCell className="text-right">{standing.pointsFor.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{standing.pointsAgainst.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{getPlayoffResultBadge(standing.playoffResult)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
