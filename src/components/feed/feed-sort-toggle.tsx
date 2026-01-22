'use client';

import { Clock, TrendingUp } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type FeedSortOption = 'recent' | 'chronological';

interface FeedSortToggleProps {
  value: FeedSortOption;
  onValueChange: (value: FeedSortOption) => void;
}

export function FeedSortToggle({ value, onValueChange }: FeedSortToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) {
          onValueChange(val as FeedSortOption);
        }
      }}
      variant="outline"
      data-testid="sort-toggle"
    >
      <ToggleGroupItem value="recent" aria-label="Sort by recent engagement">
        <TrendingUp className="h-4 w-4 mr-1" />
        Recent
      </ToggleGroupItem>
      <ToggleGroupItem value="chronological" aria-label="Sort by chronological order">
        <Clock className="h-4 w-4 mr-1" />
        Chronological
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
