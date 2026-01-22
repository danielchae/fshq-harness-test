'use client';

import { useCallback, useEffect, useState } from 'react';

import type { UserLeague } from '@/types/user-league';

interface UseUserLeaguesReturn {
  leagues: UserLeague[];
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

export function useUserLeagues(): UseUserLeaguesReturn {
  const [leagues, setLeagues] = useState<UserLeague[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeagues = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/leagues');

      if (!response.ok) {
        throw new Error('Failed to fetch user leagues');
      }

      const data = await response.json();
      setLeagues(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const retry = useCallback(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  return {
    leagues,
    isLoading,
    error,
    retry,
  };
}
