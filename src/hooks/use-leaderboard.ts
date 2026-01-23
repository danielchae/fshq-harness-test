'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardRoleFilter,
  LeaderboardScope,
  LeaderboardSeasonState,
} from '@/types/leaderboard';

interface UseLeaderboardOptions {
  leagueSlug: string;
  scope?: LeaderboardScope;
  roleFilter?: LeaderboardRoleFilter;
  weekNumber?: number;
}

interface UseLeaderboardReturn {
  standings: LeaderboardEntry[];
  scope: LeaderboardScope;
  roleFilter: LeaderboardRoleFilter;
  currentWeek: number;
  weekNumber?: number;
  seasonYear?: number;
  leagueAverage: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setScope: (scope: LeaderboardScope) => void;
  setRoleFilter: (roleFilter: LeaderboardRoleFilter) => void;
  setWeekNumber: (weekNumber: number) => void;
  // Season state
  seasonState?: LeaderboardSeasonState;
  availableWeeks: number[];
}

export function useLeaderboard({
  leagueSlug,
  scope: initialScope = 'season',
  roleFilter: initialRoleFilter = 'all',
  weekNumber: initialWeekNumber,
}: UseLeaderboardOptions): UseLeaderboardReturn {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<LeaderboardScope>(initialScope);
  const [roleFilter, setRoleFilter] = useState<LeaderboardRoleFilter>(initialRoleFilter);
  const [weekNumber, setWeekNumber] = useState<number | undefined>(initialWeekNumber);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('scope', scope);
      params.set('role', roleFilter);
      if (scope === 'weekly' && weekNumber !== undefined) {
        params.set('week', weekNumber.toString());
      }

      const url = `/api/leagues/${leagueSlug}/leaderboard?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to load leaderboard');
      }

      const result: LeaderboardResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [leagueSlug, scope, roleFilter, weekNumber]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const availableWeeks = data?.seasonState?.availableWeeks || [];

  return {
    standings: data?.standings || [],
    scope,
    roleFilter,
    currentWeek: data?.currentWeek || 1,
    weekNumber: data?.weekNumber,
    seasonYear: data?.seasonYear,
    leagueAverage: data?.leagueAverage || 0,
    isLoading,
    error,
    refetch: fetchLeaderboard,
    setScope,
    setRoleFilter,
    setWeekNumber,
    seasonState: data?.seasonState,
    availableWeeks,
  };
}
