'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { LeaderboardRoleFilter } from '@/types/leaderboard';

interface RoleFilterProps {
  value: LeaderboardRoleFilter;
  onValueChange: (value: LeaderboardRoleFilter) => void;
}

export function RoleFilter({ value, onValueChange }: RoleFilterProps) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val as LeaderboardRoleFilter)}>
      <SelectTrigger className="w-[140px]" data-testid="role-filter" aria-label="Filter by role">
        <SelectValue placeholder="Filter by role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Members</SelectItem>
        <SelectItem value="manager">Managers</SelectItem>
        <SelectItem value="fan">Fans</SelectItem>
      </SelectContent>
    </Select>
  );
}
