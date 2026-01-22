'use client';

import { Crown, Medal, Trophy } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import type { SeasonSummary } from '@/types/history';
import type { Route } from 'next';

interface SeasonCardProps {
  season: SeasonSummary;
  leagueSlug: string;
}

export function SeasonCard({ season, leagueSlug }: SeasonCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Display top 4 standings
  const topStandings = season.standings.slice(0, 4);

  return (
    <Link href={`/leagues/${leagueSlug}/history/${season.year}` as Route} className="block">
      <Card data-testid="season-card" className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span data-testid="season-year">{season.year}</span>
              <span className="text-muted-foreground text-sm font-normal">Season</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{season.format}</Badge>
              <Badge variant="outline">{season.teamCount} teams</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Champion and Runner-up */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Champion */}
            <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-3">
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={season.champion.avatarUrl} alt={season.champion.teamName} />
                  <AvatarFallback>{getInitials(season.champion.teamName)}</AvatarFallback>
                </Avatar>
                <Crown className="absolute -right-1 -top-1 h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-yellow-700">Champion</p>
                <p data-testid="champion-name" className="font-semibold">
                  {season.champion.teamName}
                </p>
                <p className="text-muted-foreground text-sm">
                  {season.champion.managerName} • {season.champion.record}
                </p>
              </div>
            </div>

            {/* Runner-up */}
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={season.runnerUp.avatarUrl} alt={season.runnerUp.teamName} />
                  <AvatarFallback>{getInitials(season.runnerUp.teamName)}</AvatarFallback>
                </Avatar>
                <Medal className="absolute -right-1 -top-1 h-4 w-4 text-slate-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Runner-up</p>
                <p data-testid="runner-up-name" className="font-semibold">
                  {season.runnerUp.teamName}
                </p>
                <p className="text-muted-foreground text-sm">
                  {season.runnerUp.managerName} • {season.runnerUp.record}
                </p>
              </div>
            </div>
          </div>

          {/* Championship Score */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-muted-foreground mb-1 text-xs">
              Championship Game (Week {season.championshipScore.week})
            </p>
            <p className="text-lg font-bold">
              {season.championshipScore.championPoints} - {season.championshipScore.runnerUpPoints}
            </p>
          </div>

          {/* Final Standings Preview */}
          <div data-testid="final-standings">
            <p className="mb-2 text-sm font-medium">Final Standings</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Record</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topStandings.map((standing) => (
                  <TableRow key={standing.teamId}>
                    <TableCell className="font-medium">{standing.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={standing.avatarUrl} alt={standing.teamName} />
                          <AvatarFallback className="text-xs">{getInitials(standing.teamName)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{standing.teamName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {standing.wins}-{standing.losses}
                    </TableCell>
                    <TableCell className="text-right">{standing.pointsFor.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {season.standings.length > 4 && (
              <p className="text-muted-foreground mt-2 text-center text-xs">
                +{season.standings.length - 4} more teams
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
