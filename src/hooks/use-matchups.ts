'use client';

import { useCallback, useEffect, useState } from 'react';

import { getCurrentNFLWeekSync, NFL_TOTAL_WEEKS } from '@/lib/nfl-week';

import type { DisplayMatchup, MatchupsResponse } from '@/types/matchups';

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
}

export function useMatchups({ leagueSlug, initialWeek }: UseMatchupsOptions): UseMatchupsReturn {
  // Use calculated current week as fallback if no initial week provided
  const defaultWeek = initialWeek ?? getCurrentNFLWeekSync();

  const [matchups, setMatchups] = useState<DisplayMatchup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(defaultWeek);
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);
  const [totalWeeks, setTotalWeeks] = useState(NFL_TOTAL_WEEKS);

  const fetchMatchups = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/matchups?leagueSlug=${encodeURIComponent(leagueSlug)}&weekNumber=${selectedWeek}`
      );

      if (!response.ok) {
        throw new Error('Failed to load matchups');
      }

      const data: MatchupsResponse = await response.json();
      setMatchups(data.matchups);
      setCurrentWeek(data.currentWeek);
      setTotalWeeks(data.totalWeeks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load matchups');
      setMatchups([]);
    } finally {
      setIsLoading(false);
    }
  }, [leagueSlug, selectedWeek]);

  useEffect(() => {
    fetchMatchups();
  }, [fetchMatchups]);

  const retry = useCallback(() => {
    fetchMatchups();
  }, [fetchMatchups]);

  return {
    matchups,
    isLoading,
    error,
    currentWeek,
    selectedWeek,
    totalWeeks,
    setSelectedWeek,
    retry,
  };
}
