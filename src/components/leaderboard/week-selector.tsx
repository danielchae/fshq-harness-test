'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NFL_TOTAL_WEEKS } from '@/lib/nfl-week';

interface WeekSelectorProps {
  value: number;
  currentWeek: number;
  onValueChange: (week: number) => void;
}

export function WeekSelector({ value, currentWeek, onValueChange }: WeekSelectorProps) {
  // Only show weeks up to the current week (can't view future weeks)
  const availableWeeks = Array.from({ length: Math.min(currentWeek, NFL_TOTAL_WEEKS) }, (_, i) => i + 1);

  return (
    <Select value={value.toString()} onValueChange={(val) => onValueChange(parseInt(val, 10))}>
      <SelectTrigger className="w-32" data-testid="week-selector" aria-label="Select week">
        <SelectValue placeholder="Select week" />
      </SelectTrigger>
      <SelectContent>
        {availableWeeks.map((week) => (
          <SelectItem key={week} value={week.toString()}>
            Week {week}
            {week === currentWeek && ' (Current)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
