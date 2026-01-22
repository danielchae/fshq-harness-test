'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { getCachedData, getMembersCacheKey, setCachedData, subscribeToCache } from '@/lib/cache';

import type { LeagueMember } from '@/types/member';

interface UseMembersOptions {
  leagueSlug: string;
}

interface UseMembersReturn {
  data: LeagueMember[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMembers({ leagueSlug }: UseMembersOptions): UseMembersReturn {
  // Start with loading=true to match server render (no cache on server)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchId, setFetchId] = useState(0);

  const cacheKey = getMembersCacheKey(leagueSlug);

  // Subscribe to cache updates
  const subscribe = useCallback((callback: () => void) => subscribeToCache(cacheKey, callback), [cacheKey]);

  const getSnapshot = useCallback(() => {
    const { data } = getCachedData<LeagueMember[]>(cacheKey);
    return data;
  }, [cacheKey]);

  // Server snapshot always returns undefined to ensure consistent SSR
  const getServerSnapshot = useCallback(() => undefined, []);

  // Use useSyncExternalStore for cache subscription
  // Use different server snapshot to avoid hydration mismatch
  const cachedData = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (!leagueSlug) {
        setError(new Error('League slug is required'));
        return;
      }

      // Only show loading if we don't have cached data
      if (showLoading) {
        setIsLoading(true);
      }

      setError(null);

      try {
        const response = await fetch(`/api/leagues/${leagueSlug}/members`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || 'Failed to fetch members';
          throw new Error(errorMessage);
        }

        const data: LeagueMember[] = await response.json();
        setCachedData(cacheKey, data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch members'));
      } finally {
        setIsLoading(false);
      }
    },
    [leagueSlug, cacheKey]
  );

  // Initial fetch and cache check
  useEffect(() => {
    const { data: cached, isStale } = getCachedData<LeagueMember[]>(cacheKey);

    if (cached) {
      // We have cached data
      if (isStale) {
        // Background refetch for stale data
        fetchData(false);
      }
      // Don't need to set loading if we have cache
      setIsLoading(false);
    } else {
      // No cache, fetch with loading state
      setIsLoading(true);
      fetchData(true);
    }
  }, [cacheKey, fetchData, fetchId]);

  const refetch = useCallback(async () => {
    setFetchId((prev) => prev + 1);
    await fetchData(true);
  }, [fetchData]);

  return {
    data: cachedData,
    isLoading: isLoading && !cachedData,
    error: cachedData ? null : error, // Don't show error if we have cached data
    refetch,
  };
}
