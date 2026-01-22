'use client';

import { useCallback, useEffect, useState } from 'react';

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
  const [matchups, setMatchups] = useState<DisplayMatchup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(initialWeek || 3);
  const [selectedWeek, setSelectedWeek] = useState(initialWeek || 3);
  const [totalWeeks, setTotalWeeks] = useState(17);

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
