'use client';

import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface WeekSelectorStripProps {
  totalWeeks: number;
  currentWeek: number;
  selectedWeek: number;
  onWeekSelect: (week: number) => void;
}

export function WeekSelectorStrip({ totalWeeks, currentWeek, selectedWeek, onWeekSelect }: WeekSelectorStripProps) {
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

  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div data-testid="week-selector-strip" data-week-selector className="w-full">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 p-1">
          {weeks.map((week) => {
            const isSelected = week === selectedWeek;
            const isCurrent = week === currentWeek;

            return (
              <Button
                key={week}
                ref={isSelected ? selectedRef : undefined}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => onWeekSelect(week)}
                className={cn('min-w-[80px] shrink-0', isCurrent && !isSelected && 'border-primary/50')}
                aria-label={`Week ${week}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
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
