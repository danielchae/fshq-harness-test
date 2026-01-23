'use client';

import { Trophy } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NFL_TOTAL_WEEKS } from '@/lib/nfl-week';

interface WeekSelectorProps {
  value: number;
  currentWeek: number;
  onValueChange: (week: number) => void;
  /** Available weeks with data (if provided, only these weeks are shown) */
  availableWeeks?: number[];
  /** Championship week for special styling */
  championshipWeek?: number;
  /** Whether the season is complete */
  isSeasonComplete?: boolean;
}

export function WeekSelector({
  value,
  currentWeek,
  onValueChange,
  availableWeeks: providedWeeks,
  championshipWeek,
  isSeasonComplete,
}: WeekSelectorProps) {
  // Use provided weeks or generate up to current week
  const availableWeeks = providedWeeks && providedWeeks.length > 0
    ? providedWeeks
    : Array.from({ length: Math.min(currentWeek, NFL_TOTAL_WEEKS) }, (_, i) => i + 1);

  return (
    <Select value={value.toString()} onValueChange={(val) => onValueChange(parseInt(val, 10))}>
      <SelectTrigger className="w-36" data-testid="week-selector" aria-label="Select week">
        <SelectValue placeholder="Select week" />
      </SelectTrigger>
      <SelectContent>
        {availableWeeks.map((week) => {
          const isCurrent = week === currentWeek && !isSeasonComplete;
          const isChampionship = week === championshipWeek;
          
          return (
            <SelectItem key={week} value={week.toString()} className="flex items-center gap-1">
              {isChampionship && <Trophy className="h-3 w-3 text-amber-500 inline mr-1" />}
              Week {week}
              {isCurrent && ' (Current)'}
              {isChampionship && !isCurrent && ' (Finals)'}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
