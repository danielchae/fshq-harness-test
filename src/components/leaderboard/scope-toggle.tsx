'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { LeaderboardScope } from '@/types/leaderboard';

interface ScopeToggleProps {
  value: LeaderboardScope;
  onValueChange: (value: LeaderboardScope) => void;
}

export function ScopeToggle({ value, onValueChange }: ScopeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) {
          onValueChange(val as LeaderboardScope);
        }
      }}
      variant="outline"
      data-testid="scope-toggle"
      aria-label="Leaderboard scope"
    >
      <ToggleGroupItem value="weekly" aria-label="Weekly standings">
        Weekly
      </ToggleGroupItem>
      <ToggleGroupItem value="season" aria-label="Season standings">
        Season
      </ToggleGroupItem>
      <ToggleGroupItem value="all-time" aria-label="All-time standings">
        All-Time
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
