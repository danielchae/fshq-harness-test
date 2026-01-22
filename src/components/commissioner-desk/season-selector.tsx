'use client';

import { Calendar } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { Season } from '@/data/desk/get-desk-data';

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeasonId: string;
  onSeasonChange: (seasonId: string) => void;
}

export function SeasonSelector({ seasons, selectedSeasonId, onSeasonChange }: SeasonSelectorProps) {
  return (
    <div data-testid="season-selector">
      <Select value={selectedSeasonId} onValueChange={onSeasonChange}>
        <SelectTrigger className="w-[180px]">
          <Calendar className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Select season" />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((season) => (
            <SelectItem
              key={season.id}
              value={season.id}
              data-selected={season.id === selectedSeasonId}
              aria-selected={season.id === selectedSeasonId}
            >
              {season.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
