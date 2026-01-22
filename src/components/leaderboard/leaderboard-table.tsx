'use client';

import { ArrowUpDown, Trophy } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { LeaderboardEntry } from '@/types/leaderboard';

type SortField = 'rank' | 'wins' | 'losses' | 'accuracy';
type SortDirection = 'asc' | 'desc';

interface LeaderboardTableProps {
  standings: LeaderboardEntry[];
  leagueAverage?: number;
}

export function LeaderboardTable({ standings, leagueAverage }: LeaderboardTableProps) {
  const [sortField, setSortField] = useState<SortField>('wins');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedStandings = [...standings].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;

    switch (sortField) {
      case 'rank':
        return (a.rank - b.rank) * multiplier;
      case 'wins':
        return (a.wins - b.wins) * multiplier;
      case 'losses':
        return (a.losses - b.losses) * multiplier;
      case 'accuracy':
        return (a.accuracy - b.accuracy) * multiplier;
      default:
        return 0;
    }
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-1">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="font-bold">1</span>
        </div>
      );
    }
    if (rank === 2) {
      return <span className="font-semibold text-gray-400">2</span>;
    }
    if (rank === 3) {
      return <span className="font-semibold text-amber-600">3</span>;
    }
    return <span>{rank}</span>;
  };

  const getRoleBadge = (role: LeaderboardEntry['role']) => {
    switch (role) {
      case 'commissioner':
        return (
          <Badge variant="default" className="text-xs">
            Commish
          </Badge>
        );
      case 'admin':
        return (
          <Badge variant="secondary" className="text-xs">
            Admin
          </Badge>
        );
      case 'manager':
        return (
          <Badge variant="outline" className="text-xs" data-role="manager">
            Manager
          </Badge>
        );
      case 'fan':
        return (
          <Badge variant="outline" className="text-xs">
            Fan
          </Badge>
        );
      default:
        return null;
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=active]:bg-accent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <Table data-testid="leaderboard-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">
            <SortableHeader field="rank">Rank</SortableHeader>
          </TableHead>
          <TableHead>Member</TableHead>
          <TableHead className="hidden text-center sm:table-cell">
            <SortableHeader field="wins">Wins</SortableHeader>
          </TableHead>
          <TableHead className="hidden text-center sm:table-cell">
            <SortableHeader field="losses">Losses</SortableHeader>
          </TableHead>
          <TableHead className="text-center">Record</TableHead>
          <TableHead className="text-center">
            <SortableHeader field="accuracy">Accuracy</SortableHeader>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedStandings.map((entry) => (
          <TableRow
            key={entry.id}
            className={cn(entry.isCurrentUser && 'bg-primary/5 highlighted current-user')}
            data-testid={entry.isCurrentUser ? 'current-user-row' : undefined}
            data-current-user={entry.isCurrentUser ? 'true' : undefined}
          >
            <TableCell className="font-medium">{getRankBadge(entry.rank)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={entry.avatarUrl} alt={entry.username} />
                  <AvatarFallback>{entry.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.username}</span>
                    {getRoleBadge(entry.role)}
                  </div>
                  {entry.teamName && <span className="text-xs text-muted-foreground">{entry.teamName}</span>}
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden text-center sm:table-cell" data-testid="wins-cell" data-wins={entry.wins}>
              {entry.wins}
            </TableCell>
            <TableCell className="hidden text-center sm:table-cell">{entry.losses}</TableCell>
            <TableCell className="text-center font-mono">
              {entry.wins}-{entry.losses}
            </TableCell>
            <TableCell className="text-center">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'font-medium',
                    leagueAverage !== undefined && entry.accuracy > leagueAverage && 'text-green-600',
                    leagueAverage !== undefined && entry.accuracy < leagueAverage && 'text-red-600'
                  )}
                >
                  {entry.accuracy}%
                </span>
                {leagueAverage !== undefined && entry.accuracy !== leagueAverage && (
                  <span className={cn('text-xs', entry.accuracy > leagueAverage ? 'text-green-600' : 'text-red-600')}>
                    {entry.accuracy > leagueAverage ? '+' : ''}
                    {entry.accuracy - leagueAverage}%
                  </span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
