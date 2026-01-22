'use client';

import { useCallback, useEffect, useState } from 'react';

import type { HiddenMoment } from '@/types/moderation';

interface UseHiddenMomentsOptions {
  leagueSlug: string;
  contentType?: string;
  moderator?: string;
}

interface UseHiddenMomentsResult {
  hiddenMoments: HiddenMoment[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  unhideMoment: (momentId: string) => Promise<boolean>;
  deleteMoment: (momentId: string) => Promise<boolean>;
}

export function useHiddenMoments(options: UseHiddenMomentsOptions): UseHiddenMomentsResult {
  const [hiddenMoments, setHiddenMoments] = useState<HiddenMoment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHiddenMoments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!options.leagueSlug) {
      setError('League slug is required');
      setHiddenMoments([]);
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      params.set('leagueSlug', options.leagueSlug);
      if (options.contentType) params.set('contentType', options.contentType);
      if (options.moderator) params.set('moderator', options.moderator);

      const url = `/api/moderation/hidden${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch hidden moments');
      }

      const data = await response.json();
      setHiddenMoments(data.hiddenMoments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setHiddenMoments([]);
    } finally {
      setIsLoading(false);
    }
  }, [options.contentType, options.leagueSlug, options.moderator]);

  useEffect(() => {
    fetchHiddenMoments();
  }, [fetchHiddenMoments]);

  const unhideMoment = useCallback(async (momentId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/moderation/unhide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId }),
      });

      if (!response.ok) {
        throw new Error('Failed to unhide moment');
      }

      const data = await response.json();
      if (data.success) {
        // Remove the moment from the local state
        setHiddenMoments((prev) => prev.filter((m) => m.id !== momentId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error unhiding moment:', err);
      return false;
    }
  }, []);

  const deleteMoment = useCallback(async (momentId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/moderation/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete moment');
      }

      const data = await response.json();
      if (data.success) {
        // Remove the moment from the local state
        setHiddenMoments((prev) => prev.filter((m) => m.id !== momentId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting moment:', err);
      return false;
    }
  }, []);

  return {
    hiddenMoments,
    isLoading,
    error,
    refetch: fetchHiddenMoments,
    unhideMoment,
    deleteMoment,
  };
}
