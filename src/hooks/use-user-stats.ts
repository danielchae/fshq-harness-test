'use client';

import { useCallback, useEffect, useState } from 'react';

import type { UserStats } from '@/types/leaderboard';

interface UseUserStatsOptions {
  leagueSlug: string;
}

interface UseUserStatsReturn {
  stats: UserStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserStats({ leagueSlug }: UseUserStatsOptions): UseUserStatsReturn {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('leagueSlug', leagueSlug);

      const url = `/api/leaderboard/user-stats?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to load user stats');
      }

      const result: UserStats = await response.json();
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load user stats');
    } finally {
      setIsLoading(false);
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchUserStats();
  }, [fetchUserStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchUserStats,
  };
}
