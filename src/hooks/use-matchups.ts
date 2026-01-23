'use client';

import { useCallback, useEffect, useState } from 'react';

import { NFL_TOTAL_WEEKS } from '@/lib/nfl-week';

import type { DisplayMatchup, MatchupsResponse, MatchupsSeasonState } from '@/types/matchups';

interface UseMatchupsOptions {
  leagueSlug: string;
  initialWeek?: number;
}

interface UseMatchupsReturn {
  matchups: DisplayMatchup[];
  isLoading: boolean;
  error: string | null;
  currentWeek: number;
  selectedWeek: number;
  totalWeeks: number;
  setSelectedWeek: (week: number) => void;
  retry: () => void;
  // Season state
  seasonState?: MatchupsSeasonState;
  availableWeeks: number[];
}

export function useMatchups({ leagueSlug, initialWeek }: UseMatchupsOptions): UseMatchupsReturn {
  const [data, setData] = useState<MatchupsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track user-selected week (undefined means use server default)
  const [selectedWeekOverride, setSelectedWeekOverride] = useState<number | undefined>(initialWeek);

  const fetchMatchups = useCallback(async (weekToFetch?: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = weekToFetch !== undefined
        ? `/api/matchups?leagueSlug=${encodeURIComponent(leagueSlug)}&weekNumber=${weekToFetch}`
        : `/api/matchups?leagueSlug=${encodeURIComponent(leagueSlug)}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to load matchups');
      }

      const result: MatchupsResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load matchups');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchMatchups(selectedWeekOverride);
  }, [fetchMatchups, selectedWeekOverride]);

  const setSelectedWeek = useCallback((week: number) => {
    setSelectedWeekOverride(week);
  }, []);

  const retry = useCallback(() => {
    fetchMatchups(selectedWeekOverride);
  }, [fetchMatchups, selectedWeekOverride]);

  const availableWeeks = data?.seasonState?.availableWeeks || [];
  const selectedWeek = selectedWeekOverride ?? data?.currentWeek ?? 1;

  return {
    matchups: data?.matchups || [],
    isLoading,
    error,
    currentWeek: data?.currentWeek || 1,
    selectedWeek,
    totalWeeks: data?.totalWeeks || NFL_TOTAL_WEEKS,
    setSelectedWeek,
    retry,
    seasonState: data?.seasonState,
    availableWeeks,
  };
}
