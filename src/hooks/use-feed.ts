'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { FeedResponse, FeedSortOption, Moment, MomentType } from '@/types/feed';

interface UseFeedOptions {
  leagueSlug: string;
  sort?: FeedSortOption;
  type?: MomentType;
}

interface UseFeedReturn {
  moments: Moment[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
  /** Remove a moment from the local state (optimistic update after delete/hide) */
  removeMoment: (momentId: string) => void;
  /** Add a moment to the beginning of the feed (optimistic update after create) */
  addMoment: (moment: Moment) => void;
  /** Refetch the feed from scratch, bypassing cache */
  refetch: () => void;
}

export function useFeed({ leagueSlug, sort, type }: UseFeedOptions): UseFeedReturn {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track a cache-bust key to force refetch
  const [cacheBustKey, setCacheBustKey] = useState(0);

  const fetchFeed = useCallback(
    async (cursor?: string, bustCache?: boolean) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const isInitialLoad = !cursor;
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const url = new URL('/api/feed', window.location.origin);
        url.searchParams.set('leagueSlug', leagueSlug);
        if (cursor) {
          url.searchParams.set('cursor', cursor);
        }
        if (sort) {
          url.searchParams.set('sort', sort);
        }
        if (type) {
          url.searchParams.set('type', type);
        }
        // Add cache-bust parameter to bypass browser and server cache
        if (bustCache) {
          url.searchParams.set('_t', Date.now().toString());
        }

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          // Bypass browser cache when busting
          ...(bustCache && { cache: 'no-store' }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch feed');
        }

        const data: FeedResponse = await response.json();

        if (isInitialLoad) {
          setMoments(data.moments);
        } else {
          setMoments((prev) => [...prev, ...data.moments]);
        }

        setNextCursor(data.nextCursor ?? null);
        setHasMore(data.nextCursor != null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [leagueSlug, sort, type]
  );

  // Initial fetch and re-fetch when sort, type, or cacheBustKey changes
  useEffect(() => {
    // Reset state when filters change
    setMoments([]);
    setNextCursor(null);
    setHasMore(true);
    // Bust cache if cacheBustKey > 0 (meaning refetch was called)
    fetchFeed(undefined, cacheBustKey > 0);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchFeed, cacheBustKey]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && nextCursor) {
      fetchFeed(nextCursor);
    }
  }, [isLoadingMore, hasMore, nextCursor, fetchFeed]);

  const retry = useCallback(() => {
    setMoments([]);
    setNextCursor(null);
    setHasMore(true);
    fetchFeed();
  }, [fetchFeed]);

  // Remove a moment from local state (used after delete/hide)
  const removeMoment = useCallback((momentId: string) => {
    setMoments((prev) => prev.filter((m) => m.id !== momentId));
  }, []);

  // Add a moment to the beginning (used after create)
  const addMoment = useCallback((moment: Moment) => {
    setMoments((prev) => {
      // Don't add if already exists
      if (prev.some((m) => m.id === moment.id)) {
        return prev;
      }
      return [moment, ...prev];
    });
  }, []);

  // Force refetch from server, bypassing cache
  const refetch = useCallback(() => {
    setCacheBustKey((k) => k + 1);
  }, []);

  return {
    moments,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    retry,
    removeMoment,
    addMoment,
    refetch,
  };
}
