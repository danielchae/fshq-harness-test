'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PowerRankingsData, TeamRanking } from '@/data/power-rankings/get-power-rankings';

interface UsePowerRankingsOptions {
  leagueSlug: string;
  weekNumber: number;
  onSaveStatusChange?: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export function usePowerRankings({ leagueSlug, weekNumber, onSaveStatusChange }: UsePowerRankingsOptions) {
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | undefined>();

  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<{
    rankings?: TeamRanking[];
    teamId?: string;
    commentary?: string;
  } | null>(null);

  // Fetch rankings on mount or when week changes
  useEffect(() => {
    async function fetchRankings() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/power-rankings?leagueSlug=${leagueSlug}&weekNumber=${weekNumber}`);

        if (!response.ok) {
          throw new Error('Failed to fetch rankings');
        }

        const data: PowerRankingsData = await response.json();
        setRankings(data.rankings);
        setLastSaved(data.lastSaved);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRankings();
  }, [leagueSlug, weekNumber]);

  // Save rankings order
  const saveRankingsOrder = useCallback(
    async (newRankings: TeamRanking[]) => {
      onSaveStatusChange?.('saving');

      try {
        const response = await fetch('/api/power-rankings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueSlug,
            weekNumber,
            rankings: newRankings,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save rankings');
        }

        const data: PowerRankingsData = await response.json();
        setLastSaved(data.lastSaved);
        onSaveStatusChange?.('saved');
      } catch {
        onSaveStatusChange?.('error');
      }
    },
    [leagueSlug, weekNumber, onSaveStatusChange]
  );

  // Save commentary for a team
  const saveCommentary = useCallback(
    async (teamId: string, commentary: string) => {
      onSaveStatusChange?.('saving');

      try {
        const response = await fetch('/api/power-rankings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueSlug,
            weekNumber,
            teamId,
            commentary,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save commentary');
        }

        const data: PowerRankingsData = await response.json();
        setLastSaved(data.lastSaved);
        onSaveStatusChange?.('saved');
      } catch {
        onSaveStatusChange?.('error');
      }
    },
    [leagueSlug, weekNumber, onSaveStatusChange]
  );

  // Handle reordering
  const reorderRankings = useCallback(
    (fromIndex: number, toIndex: number) => {
      setRankings((prev) => {
        const newRankings = [...prev];
        const [removed] = newRankings.splice(fromIndex, 1);
        if (removed) {
          // When dragging forward (higher index), adjust target since removing earlier item shifts indices down
          const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
          newRankings.splice(adjustedToIndex, 0, removed);
        }

        // Update ranks based on new positions
        const updatedRankings = newRankings.map((r, index) => ({
          ...r,
          rank: index + 1,
        }));

        // Clear existing autosave timeout
        if (autosaveTimeoutRef.current) {
          clearTimeout(autosaveTimeoutRef.current);
        }

        // Schedule autosave
        pendingSaveRef.current = { rankings: updatedRankings };
        autosaveTimeoutRef.current = setTimeout(() => {
          if (pendingSaveRef.current?.rankings) {
            saveRankingsOrder(pendingSaveRef.current.rankings);
          }
        }, 1000);

        return updatedRankings;
      });
    },
    [saveRankingsOrder]
  );

  // Handle commentary change with debounced autosave
  const updateCommentary = useCallback(
    (teamId: string, commentary: string) => {
      setRankings((prev) => prev.map((r) => (r.teamId === teamId ? { ...r, commentary } : r)));

      // Clear existing autosave timeout
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      // Schedule autosave after typing stops (1 second)
      pendingSaveRef.current = { teamId, commentary };
      autosaveTimeoutRef.current = setTimeout(() => {
        if (pendingSaveRef.current?.teamId) {
          saveCommentary(pendingSaveRef.current.teamId, pendingSaveRef.current.commentary || '');
        }
      }, 1000);
    },
    [saveCommentary]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    rankings,
    isLoading,
    error,
    lastSaved,
    reorderRankings,
    updateCommentary,
  };
}
