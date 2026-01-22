'use client';

import { Check, Circle, Clock, FileText } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { Week } from '@/data/desk/get-desk-data';

interface WeekSelectorProps {
  weeks: Week[];
  selectedWeek: number;
  onWeekChange: (weekNumber: number) => void;
}

export function WeekSelector({ weeks, selectedWeek, onWeekChange }: WeekSelectorProps) {
  const getStatusIcon = (status: Week['status']) => {
    switch (status) {
      case 'published':
        return <Check className="h-3 w-3 text-green-500" />;
      case 'draft':
        return <Clock className="h-3 w-3 text-orange-500" />;
      case 'empty':
        return <Circle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const currentWeek = weeks.find((w) => w.number === selectedWeek);

  return (
    <div data-testid="week-selector">
      {/* Hidden indicator for current selection - used by e2e tests */}
      <span data-selected="true" aria-selected="true" className="sr-only">
        Week {selectedWeek} selected
      </span>
      <Select value={selectedWeek.toString()} onValueChange={(value) => onWeekChange(parseInt(value, 10))}>
        <SelectTrigger className="w-[180px]">
          <FileText className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Select week">
            {currentWeek && (
              <div className="flex items-center gap-2">
                {getStatusIcon(currentWeek.status)}
                <span>{currentWeek.label}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {weeks.map((week) => (
            <SelectItem key={week.id} value={week.number.toString()}>
              <div className="flex items-center gap-2">
                {getStatusIcon(week.status)}
                <span>{week.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
