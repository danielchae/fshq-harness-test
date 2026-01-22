'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SeasonSelectorProps {
  seasons: number[];
  selectedSeason: number;
  onSeasonChange: (season: number) => void;
}

export function SeasonSelector({ seasons, selectedSeason, onSeasonChange }: SeasonSelectorProps) {
  const currentYear = new Date().getFullYear();

  return (
    <Select value={selectedSeason.toString()} onValueChange={(value) => onSeasonChange(parseInt(value, 10))}>
      <SelectTrigger className="w-[140px]" data-testid="season-selector" aria-label="Select season">
        <SelectValue placeholder="Select season" />
      </SelectTrigger>
      <SelectContent>
        {seasons.map((season) => (
          <SelectItem key={season} value={season.toString()}>
            {season} {season === currentYear && '(Current)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
