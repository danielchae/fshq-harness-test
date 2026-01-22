'use client';

import { Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BracketTeamSlot } from './bracket-team-slot';

import type { BracketMatchup as BracketMatchupType } from '@/types/brackets';

interface BracketMatchupProps {
  matchup: BracketMatchupType;
  className?: string;
  isChampionship?: boolean;
}

export function BracketMatchup({ matchup, className, isChampionship = false }: BracketMatchupProps) {
  const { homeTeam, awayTeam, isComplete, status, winnerId, sourceMatchups } = matchup;

  const getStatusBadge = () => {
    switch (status) {
      case 'in_progress':
        return (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-500">
            LIVE
          </Badge>
        );
      case 'complete':
        return (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            FINAL
          </Badge>
        );
      default:
        return null;
    }
  };

  // Generate placeholder text for TBD teams
  const getPlaceholderText = (slot: 'home' | 'away') => {
    if (sourceMatchups) {
      const sourceId = slot === 'home' ? sourceMatchups.home : sourceMatchups.away;
      if (sourceId) {
        // Extract round number from matchup ID (e.g., 'matchup-r2-1' -> 'Round 2')
        const roundMatch = sourceId.match(/r(\d+)/);
        if (roundMatch) {
          return `Winner of Round ${roundMatch[1]}`;
        }
        return 'Winner of Previous Round';
      }
    }
    return 'TBD';
  };

  return (
    <Card
      className={cn(
        'w-[220px] overflow-hidden py-0 gap-0',
        status === 'in_progress' && 'ring-2 ring-amber-500/50',
        isChampionship && isComplete && 'ring-2 ring-amber-400',
        className
      )}
      data-testid="bracket-matchup"
      data-complete={isComplete ? 'true' : 'false'}
      data-winner-id={winnerId}
      data-championship={isChampionship ? 'true' : 'false'}
    >
      {/* Status Badge with Championship Trophy */}
      <div className="px-2 py-1 bg-muted/30 flex justify-between items-center">
        {isChampionship && isComplete && (
          <div className="flex items-center gap-1 text-amber-500">
            <Trophy className="h-3 w-3" data-icon="trophy" />
            <span className="text-[10px] font-semibold">CHAMPION</span>
          </div>
        )}
        {!isChampionship && <div />}
        {getStatusBadge()}
      </div>

      {/* Home Team (Top) */}
      <BracketTeamSlot
        teamData={homeTeam}
        position="top"
        showScore={status !== 'scheduled'}
        matchupComplete={isComplete}
        placeholderText={!homeTeam.team ? getPlaceholderText('home') : undefined}
        showTrophy={isChampionship && isComplete && homeTeam.isWinner}
      />

      {/* Away Team (Bottom) */}
      <BracketTeamSlot
        teamData={awayTeam}
        position="bottom"
        showScore={status !== 'scheduled'}
        matchupComplete={isComplete}
        placeholderText={!awayTeam.team ? getPlaceholderText('away') : undefined}
        showTrophy={isChampionship && isComplete && awayTeam.isWinner}
      />
    </Card>
  );
}
