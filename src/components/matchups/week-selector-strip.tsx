'use client';

import { Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface WeekSelectorStripProps {
  totalWeeks: number;
  currentWeek: number;
  selectedWeek: number;
  onWeekSelect: (week: number) => void;
  /** Available weeks with data (if provided, only these weeks are enabled) */
  availableWeeks?: number[];
  /** Championship week for special styling */
  championshipWeek?: number;
  /** Whether the season is complete */
  isSeasonComplete?: boolean;
}

export function WeekSelectorStrip({
  totalWeeks,
  currentWeek,
  selectedWeek,
  onWeekSelect,
  availableWeeks,
  championshipWeek,
  isSeasonComplete,
}: WeekSelectorStripProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected week into view when component mounts or selection changes
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedWeek]);

  // Use available weeks if provided, otherwise generate all weeks
  const weeks = availableWeeks && availableWeeks.length > 0
    ? availableWeeks
    : Array.from({ length: totalWeeks }, (_, i) => i + 1);

  // Check if a week has data (if availableWeeks is provided)
  const hasData = (week: number) => !availableWeeks || availableWeeks.includes(week);

  return (
    <div data-testid="week-selector-strip" data-week-selector className="w-full">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 p-1">
          {weeks.map((week) => {
            const isSelected = week === selectedWeek;
            const isCurrent = week === currentWeek && !isSeasonComplete;
            const isChampionship = week === championshipWeek;
            const isEnabled = hasData(week);

            return (
              <Button
                key={week}
                ref={isSelected ? selectedRef : undefined}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => isEnabled && onWeekSelect(week)}
                disabled={!isEnabled}
                className={cn(
                  'min-w-[80px] shrink-0 gap-1',
                  isCurrent && !isSelected && 'border-primary/50 ring-1 ring-primary/30',
                  isChampionship && !isSelected && 'border-amber-500/50',
                  !isEnabled && 'opacity-40'
                )}
                aria-label={`Week ${week}${isChampionship ? ' (Championship)' : ''}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {isChampionship && <Trophy className="h-3 w-3 text-amber-500" />}
                Week {week}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
