'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { MatchupPrediction, MatchupPredictionsData } from '@/data/matchup-predictions/get-matchup-predictions';

interface UseMatchupPredictionsOptions {
  leagueSlug: string;
  weekNumber: number;
  onSaveStatusChange?: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export function useMatchupPredictions({ leagueSlug, weekNumber, onSaveStatusChange }: UseMatchupPredictionsOptions) {
  const [predictions, setPredictions] = useState<MatchupPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | undefined>();

  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<{
    matchupId: string;
    updates: Partial<MatchupPrediction>;
  } | null>(null);

  // Fetch predictions on mount or when week changes
  useEffect(() => {
    async function fetchPredictions() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/matchup-predictions?leagueSlug=${leagueSlug}&weekNumber=${weekNumber}`);

        if (!response.ok) {
          throw new Error('Failed to fetch matchup predictions');
        }

        const data: MatchupPredictionsData = await response.json();
        setPredictions(data.predictions);
        setLastSaved(data.lastSaved);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPredictions();
  }, [leagueSlug, weekNumber]);

  // Save a single prediction update
  const savePrediction = useCallback(
    async (matchupId: string, updates: Partial<MatchupPrediction>) => {
      onSaveStatusChange?.('saving');

      try {
        const response = await fetch('/api/matchup-predictions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueSlug,
            weekNumber,
            matchupId,
            ...updates,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save prediction');
        }

        const data: MatchupPredictionsData = await response.json();
        setPredictions(data.predictions);
        setLastSaved(data.lastSaved);
        onSaveStatusChange?.('saved');
      } catch {
        onSaveStatusChange?.('error');
      }
    },
    [leagueSlug, weekNumber, onSaveStatusChange]
  );

  // Update prediction locally and schedule autosave
  const updatePrediction = useCallback(
    (matchupId: string, updates: Partial<MatchupPrediction>) => {
      setPredictions((prev) =>
        prev.map((pred) => {
          if (pred.matchupId !== matchupId) {
            // If this is a feature toggle and we're turning it on, turn off others
            if (updates.isFeatured === true && pred.isFeatured) {
              return { ...pred, isFeatured: false };
            }
            return pred;
          }
          return { ...pred, ...updates };
        })
      );

      // Clear existing timeout
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      // Schedule autosave
      pendingSaveRef.current = { matchupId, updates };
      autosaveTimeoutRef.current = setTimeout(() => {
        if (pendingSaveRef.current) {
          savePrediction(pendingSaveRef.current.matchupId, pendingSaveRef.current.updates);
        }
      }, 1000);
    },
    [savePrediction]
  );

  // Toggle featured status (only one can be featured at a time)
  const toggleFeatured = useCallback(
    (matchupId: string) => {
      const prediction = predictions.find((p) => p.matchupId === matchupId);
      if (!prediction) return;

      updatePrediction(matchupId, { isFeatured: !prediction.isFeatured });
    },
    [predictions, updatePrediction]
  );

  // Update hype text with debounced autosave
  const updateHypeText = useCallback(
    (matchupId: string, hypeText: string) => {
      updatePrediction(matchupId, { hypeText });
    },
    [updatePrediction]
  );

  // Update predicted winner
  const updatePredictedWinner = useCallback(
    (matchupId: string, predictedWinnerId: string | undefined) => {
      updatePrediction(matchupId, { predictedWinnerId });
    },
    [updatePrediction]
  );

  // Get featured prediction
  const getFeaturedPrediction = useCallback(() => {
    return predictions.find((p) => p.isFeatured);
  }, [predictions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    predictions,
    isLoading,
    error,
    lastSaved,
    updatePrediction,
    toggleFeatured,
    updateHypeText,
    updatePredictedWinner,
    getFeaturedPrediction,
  };
}
