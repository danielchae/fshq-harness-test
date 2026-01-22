'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Transaction, TransactionsResponse, TransactionType } from '@/types/transactions';

interface UseTransactionsOptions {
  leagueSlug: string;
  type?: TransactionType;
  teamId?: string;
  playerSearch?: string;
}

interface UseTransactionsReturn {
  transactions: Transaction[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

export function useTransactions({
  leagueSlug,
  type,
  teamId,
  playerSearch,
}: UseTransactionsOptions): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTransactions = useCallback(
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
        const url = new URL('/api/transactions', window.location.origin);
        url.searchParams.set('leagueSlug', leagueSlug);
        if (cursor) {
          url.searchParams.set('cursor', cursor);
        }
        if (type) {
          url.searchParams.set('type', type);
        }
        if (teamId) {
          url.searchParams.set('teamId', teamId);
        }
        if (playerSearch) {
          url.searchParams.set('playerSearch', playerSearch);
        }

        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data: TransactionsResponse = await response.json();

        if (isInitialLoad) {
          setTransactions(data.transactions);
        } else {
          setTransactions((prev) => [...prev, ...data.transactions]);
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
    [leagueSlug, type, teamId, playerSearch]
  );

  // Initial fetch and re-fetch when filters change
  useEffect(() => {
    // Reset state when filters change
    setTransactions([]);
    setNextCursor(null);
    setHasMore(true);
    fetchTransactions();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTransactions]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && nextCursor) {
      fetchTransactions(nextCursor);
    }
  }, [isLoadingMore, hasMore, nextCursor, fetchTransactions]);

  const retry = useCallback(() => {
    setTransactions([]);
    setNextCursor(null);
    setHasMore(true);
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    retry,
  };
}
