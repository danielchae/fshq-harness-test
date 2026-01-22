'use client';

import { Check, X } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StatCorrectionBadge } from './StatCorrectionBadge';

import type { PickemMatchup } from '@/types/pickems';

interface PickResultCardProps {
  matchup: PickemMatchup;
}

export function PickResultCard({ matchup }: PickResultCardProps) {
  const { homeTeam, awayTeam, isCorrect, userPick, winnerId, hasStatCorrection } = matchup;

  // Determine which team the user picked
  const pickedHomeTeam = userPick === homeTeam.id;
  const pickedAwayTeam = userPick === awayTeam.id;

  // Determine which team won
  const homeTeamWon = winnerId === homeTeam.id;
  const awayTeamWon = winnerId === awayTeam.id;

  return (
    <Card data-testid="pick-result-card" className="relative">
      {/* Hidden attribute elements for test queries */}
      <span data-correct={isCorrect} className="hidden" />
      {hasStatCorrection && <span data-stat-correction="true" className="hidden" />}
      <CardContent className="pt-6">
        <div className="flex items-center justify-center gap-4">
          {/* Home Team */}
          <div
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg transition-all',
              homeTeamWon && 'bg-green-50 ring-2 ring-green-500/50',
              pickedHomeTeam && !homeTeamWon && 'bg-red-50 ring-2 ring-red-500/50'
            )}
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={homeTeam.avatarUrl} alt={homeTeam.name} />
              <AvatarFallback>{homeTeam.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold">Team: {homeTeam.name}</span>
            <span className="text-xs text-muted-foreground">@{homeTeam.ownerUsername}</span>
            {homeTeam.score !== undefined && (
              <Badge variant={homeTeamWon ? 'default' : 'secondary'} className="text-lg">
                {homeTeam.score} pts
              </Badge>
            )}
            {pickedHomeTeam && (
              <Badge variant="outline" className="gap-1">
                Your Pick
              </Badge>
            )}
          </div>

          {/* VS and Result Indicator */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-lg font-bold text-muted-foreground">VS</span>

            {/* Correct/Incorrect Indicator */}
            {isCorrect !== undefined && (
              <div className="flex flex-col items-center gap-1">
                {isCorrect ? (
                  <div
                    data-testid="correct-indicator"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white"
                  >
                    <Check className="h-6 w-6" data-icon="check" />
                  </div>
                ) : (
                  <div
                    data-testid="incorrect-indicator"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white"
                  >
                    <X className="h-6 w-6" data-icon="x" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Away Team */}
          <div
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg transition-all',
              awayTeamWon && 'bg-green-50 ring-2 ring-green-500/50',
              pickedAwayTeam && !awayTeamWon && 'bg-red-50 ring-2 ring-red-500/50'
            )}
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={awayTeam.avatarUrl} alt={awayTeam.name} />
              <AvatarFallback>{awayTeam.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold">Team: {awayTeam.name}</span>
            <span className="text-xs text-muted-foreground">@{awayTeam.ownerUsername}</span>
            {awayTeam.score !== undefined && (
              <Badge variant={awayTeamWon ? 'default' : 'secondary'} className="text-lg">
                {awayTeam.score} pts
              </Badge>
            )}
            {pickedAwayTeam && (
              <Badge variant="outline" className="gap-1">
                Your Pick
              </Badge>
            )}
          </div>
        </div>

        {/* Stat Correction Badge */}
        {hasStatCorrection && (
          <div className="mt-4 flex justify-center">
            <StatCorrectionBadge />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
