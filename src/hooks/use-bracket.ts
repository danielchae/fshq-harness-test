'use client';

import { useCallback, useEffect, useState } from 'react';

import type { BracketResponse } from '@/types/brackets';

interface UseBracketReturn {
  data: BracketResponse | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function useBracket(leagueSlug: string, season?: number): UseBracketReturn {
  const [data, setData] = useState<BracketResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBracket = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ leagueSlug });
      if (season) {
        params.set('season', season.toString());
      }

      const response = await fetch(`/api/brackets?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch bracket data: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching bracket:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bracket data');
    } finally {
      setIsLoading(false);
    }
  }, [leagueSlug, season]);

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);

  const retry = useCallback(() => {
    fetchBracket();
  }, [fetchBracket]);

  return {
    data,
    isLoading,
    error,
    retry,
  };
}
