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
}

export function useFeed({ leagueSlug, sort, type }: UseFeedOptions): UseFeedReturn {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFeed = useCallback(
    async (cursor?: string) => {
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

        const response = await fetch(url.toString(), {
          signal: controller.signal,
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

  // Initial fetch and re-fetch when sort or type changes
  useEffect(() => {
    // Reset state when filters change
    setMoments([]);
    setNextCursor(null);
    setHasMore(true);
    fetchFeed();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchFeed]);

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

  return {
    moments,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    retry,
  };
}
