'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { getCachedData, getLeagueCacheKey, markRevalidated, setCachedData, subscribeToCache } from '@/lib/cache';

import type { League } from '@/types/league';

interface UseLeagueOptions {
  slug: string;
}

interface UseLeagueReturn {
  data: League | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useLeague({ slug }: UseLeagueOptions): UseLeagueReturn {
  const cacheKey = getLeagueCacheKey(slug);

  // Track if component has mounted (for hydration-safe loading states)
  const [hasMounted, setHasMounted] = useState(false);
  // Start with loading=true to match server render (no cache on server)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchedRef = useRef(false);

  // Set mounted after hydration to enable client-only loading states
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Subscribe to cache updates
  const subscribe = useCallback((callback: () => void) => subscribeToCache(cacheKey, callback), [cacheKey]);

  const getSnapshot = useCallback(() => {
    const { data } = getCachedData<League>(cacheKey);
    return data;
  }, [cacheKey]);

  // Server snapshot always returns undefined to ensure consistent SSR
  const getServerSnapshot = useCallback(() => undefined, []);

  // Use useSyncExternalStore for cache subscription
  // Use different server snapshot to avoid hydration mismatch
  const cachedData = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (!slug) {
        setError(new Error('League slug is required'));
        setIsLoading(false);
        return;
      }

      // Only show loading if we don't have cached data
      if (showLoading) {
        setIsLoading(true);
      }

      setError(null);

      try {
        const response = await fetch(`/api/leagues/${slug}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error || (response.status === 404 ? 'League not found' : 'Failed to fetch league');
          throw new Error(errorMessage);
        }

        const data: League = await response.json();
        setCachedData(cacheKey, data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch league'));
      } finally {
        setIsLoading(false);
      }
    },
    [slug, cacheKey]
  );

  // Initial fetch and cache check - only after hydration is complete
  useEffect(() => {
    // Skip if we already fetched for this slug or not yet mounted
    if (fetchedRef.current || !hasMounted) {
      return;
    }

    const { data: cached, needsRevalidation } = getCachedData<League>(cacheKey);

    if (cached) {
      // We have cached data
      fetchedRef.current = true;
      setIsLoading(false);
      if (needsRevalidation) {
        // Mark as revalidated so we don't refetch again this session
        markRevalidated(cacheKey);
        // Background refetch for stale/reload data
        // Use requestAnimationFrame + setTimeout to ensure stale data renders first
        // rAF ensures React commits to DOM, then setTimeout starts background fetch
        // This provides reliable stale-while-revalidate UX
        requestAnimationFrame(() => {
          setTimeout(() => fetchData(false), 50);
        });
      }
    } else {
      // No cache, fetch with loading state
      fetchedRef.current = true;
      fetchData(true);
    }
  }, [cacheKey, fetchData, hasMounted]);

  // Reset fetchedRef when slug changes
  useEffect(() => {
    fetchedRef.current = false;
  }, [slug]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    data: cachedData,
    isLoading: isLoading && !cachedData,
    error: cachedData ? null : error, // Don't show error if we have cached data
    refetch,
  };
}
