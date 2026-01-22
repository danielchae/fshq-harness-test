'use client';

import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BracketMatchup } from './bracket-matchup';

import type { BracketRound as BracketRoundType } from '@/types/brackets';

interface BracketRoundProps {
  round: BracketRoundType;
  isChampionship?: boolean;
  isMobile?: boolean;
  bracketType?: 'winners' | 'losers' | 'consolation';
}

export function BracketRound({ round, isChampionship = false, isMobile = false }: BracketRoundProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { name, matchups, isCurrent } = round;

  // Mobile: Collapsible rounds
  if (isMobile) {
    return (
      <div className="w-full">
        <Button
          variant="ghost"
          className={cn('w-full justify-between px-3 py-2 h-auto', isCurrent && 'bg-primary/10')}
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
        >
          <div className="flex items-center gap-2">
            {isChampionship && <Trophy className="h-4 w-4 text-amber-500" />}
            <span className="font-semibold text-sm">{name}</span>
            {isCurrent && (
              <Badge variant="default" className="text-[10px]">
                Current
              </Badge>
            )}
          </div>
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>

        {!isCollapsed && (
          <div className="flex flex-col gap-3 p-3">
            {matchups.map((matchup) => (
              <BracketMatchup
                key={matchup.id}
                matchup={matchup}
                className="w-full max-w-none"
                isChampionship={isChampionship}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop: Vertical stack within round column
  return (
    <div className={cn('flex flex-col items-center gap-4', isCurrent && 'relative')}>
      {/* Round Header */}
      <div className="flex items-center gap-2 mb-2">
        {isChampionship && <Trophy className="h-4 w-4 text-amber-500" />}
        <h3 className={cn('font-semibold text-sm', isCurrent && 'text-primary')}>{name}</h3>
        {isCurrent && (
          <Badge variant="default" className="text-[10px]">
            Current
          </Badge>
        )}
      </div>

      {/* Matchups - spaced evenly */}
      <div className={cn('flex flex-col justify-around flex-1 gap-6', matchups.length === 1 && 'justify-center')}>
        {matchups.map((matchup) => (
          <div key={matchup.id} className="relative">
            <BracketMatchup matchup={matchup} isChampionship={isChampionship} />
          </div>
        ))}
      </div>
    </div>
  );
}
