'use client';

import { FileText, MessageSquare, Package, TrendingUp, Trophy } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { MomentType } from '@/types/feed';

export type TypeFilterValue = MomentType | 'all';

interface TypeFilterDropdownProps {
  value: TypeFilterValue;
  onValueChange: (value: TypeFilterValue) => void;
}

const typeOptions: { value: TypeFilterValue; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'All Types', icon: MessageSquare },
  { value: 'post', label: 'Post', icon: MessageSquare },
  { value: 'trade', label: 'Trade', icon: Package },
  { value: 'rankings', label: 'Rankings', icon: TrendingUp },
  { value: 'prediction', label: 'Prediction', icon: TrendingUp },
  { value: 'matchResult', label: 'Match Result', icon: Trophy },
  { value: 'transaction', label: 'Transaction', icon: FileText },
];

export function TypeFilterDropdown({ value, onValueChange }: TypeFilterDropdownProps) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val as TypeFilterValue)}>
      <SelectTrigger data-testid="type-filter" className="w-[150px]">
        <SelectValue placeholder="Filter by type" />
      </SelectTrigger>
      <SelectContent>
        {typeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem key={option.value} value={option.value}>
              <Icon className="h-4 w-4 mr-2 inline" aria-hidden="true" />
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
