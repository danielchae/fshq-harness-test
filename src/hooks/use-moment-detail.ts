'use client';

import { useCallback, useEffect, useState } from 'react';

import type { MomentDetail } from '@/types/feed';

interface UseMomentDetailOptions {
  momentId: string;
}

interface UseMomentDetailResult {
  moment: MomentDetail | null;
  isLoading: boolean;
  error: Error | null;
  notFound: boolean;
  refetch: () => void;
}

export function useMomentDetail({ momentId }: UseMomentDetailOptions): UseMomentDetailResult {
  const [moment, setMoment] = useState<MomentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchMoment = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await fetch(`/api/moments/${momentId}`);

      if (response.status === 404) {
        setNotFound(true);
        setMoment(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch moment');
      }

      const data = await response.json();
      setMoment(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [momentId]);

  useEffect(() => {
    fetchMoment();
  }, [fetchMoment]);

  return {
    moment,
    isLoading,
    error,
    notFound,
    refetch: fetchMoment,
  };
}
