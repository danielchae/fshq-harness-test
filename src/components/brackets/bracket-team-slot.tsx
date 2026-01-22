'use client';

import { Trophy } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { BracketMatchupTeam } from '@/types/brackets';

interface BracketTeamSlotProps {
  teamData: BracketMatchupTeam;
  position: 'top' | 'bottom';
  showScore?: boolean;
  matchupComplete?: boolean;
  placeholderText?: string;
  showTrophy?: boolean;
}

export function BracketTeamSlot({
  teamData,
  position,
  showScore = true,
  matchupComplete = false,
  placeholderText,
  showTrophy = false,
}: BracketTeamSlotProps) {
  const { team, score, isWinner, isBye } = teamData;

  // Handle BYE slot
  if (isBye) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-2 py-1.5 min-h-[40px]',
          'border-l-2 border-transparent',
          position === 'top' ? 'border-b border-border/50' : ''
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground italic">BYE</span>
        </div>
      </div>
    );
  }

  // Handle TBD/placeholder slot
  if (!team) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-2 py-1.5 min-h-[40px]',
          'border-l-2 border-dashed border-muted-foreground/30',
          position === 'top' ? 'border-b border-border/50' : ''
        )}
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">?</span>
          </div>
          <span className="text-xs text-muted-foreground italic">{placeholderText || 'TBD'}</span>
        </div>
      </div>
    );
  }

  const formatRecord = () => {
    if (!team.record) return null;
    const { wins, losses, ties } = team.record;
    if (ties && ties > 0) {
      return `${wins}-${losses}-${ties}`;
    }
    return `${wins}-${losses}`;
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-2 py-1.5 min-h-[40px] transition-colors',
        'border-l-2',
        matchupComplete && isWinner ? 'bg-green-50 border-green-500' : 'border-transparent',
        matchupComplete && !isWinner ? 'opacity-60' : '',
        position === 'top' ? 'border-b border-border/50' : ''
      )}
      data-winner={isWinner ? 'true' : 'false'}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Seed Number */}
        <Badge
          variant="outline"
          className="h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold shrink-0"
          data-testid="seed-number"
          data-seed={team.seed}
        >
          {team.seed}
        </Badge>

        {/* Team Avatar */}
        <Avatar className="h-6 w-6 shrink-0" data-testid="team-logo">
          <AvatarImage src={team.avatarUrl} alt={`${team.name} logo`} />
          <AvatarFallback className="text-[10px] font-medium">{team.name.charAt(0)}</AvatarFallback>
        </Avatar>

        {/* Team Name and Record */}
        <div className="flex flex-col min-w-0">
          <span
            className={cn('text-xs font-medium truncate', matchupComplete && isWinner ? 'text-green-700' : '')}
            data-testid="team-name"
          >
            {team.name}
          </span>
          {formatRecord() && <span className="text-[10px] text-muted-foreground">{formatRecord()}</span>}
        </div>
      </div>

      {/* Score and Trophy */}
      <div className="flex items-center gap-1 shrink-0">
        {showTrophy && <Trophy className="h-4 w-4 text-amber-500" data-icon="trophy" />}
        {showScore && score !== undefined && (
          <span
            className={cn('text-sm font-semibold tabular-nums', matchupComplete && isWinner ? 'text-green-700' : '')}
            data-testid="team-score"
          >
            {score.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}
