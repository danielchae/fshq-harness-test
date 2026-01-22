'use client';

import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { TransactionType } from '@/types/transactions';

export interface Team {
  id: string;
  name: string;
}

interface TransactionFiltersProps {
  typeFilter: TransactionType | 'all';
  onTypeFilterChange: (value: TransactionType | 'all') => void;
  teamFilter: string;
  onTeamFilterChange: (value: string) => void;
  playerSearch: string;
  onPlayerSearchChange: (value: string) => void;
  onClearFilters: () => void;
  teams: Team[];
  hasActiveFilters: boolean;
}

export function TransactionFilters({
  typeFilter,
  onTypeFilterChange,
  teamFilter,
  onTeamFilterChange,
  playerSearch,
  onPlayerSearchChange,
  onClearFilters,
  teams,
  hasActiveFilters,
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={(value) => onTypeFilterChange(value as TransactionType | 'all')}>
          <SelectTrigger className="w-full sm:w-[160px]" data-testid="type-filter" aria-label="Filter by type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="trade">Trades</SelectItem>
            <SelectItem value="waiver">Waivers</SelectItem>
            <SelectItem value="free_agent">Free Agent</SelectItem>
            <SelectItem value="drop">Drops</SelectItem>
          </SelectContent>
        </Select>

        {/* Team Filter */}
        <Select value={teamFilter} onValueChange={onTeamFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="team-filter" aria-label="Filter by team">
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Player Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search player..."
            value={playerSearch}
            onChange={(e) => onPlayerSearchChange(e.target.value)}
            className="w-full pl-9 sm:w-[200px]"
            data-testid="player-search"
            aria-label="Search by player name"
          />
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-2" data-testid="clear-filters">
          <X className="h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
