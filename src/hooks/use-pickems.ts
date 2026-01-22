'use client';

import { useCallback, useEffect, useState } from 'react';

import type { PickemMatchup, PickemsResponse, WeeklyScore } from '@/types/pickems';

interface UsePickemsOptions {
  leagueSlug: string;
  weekNumber?: number;
}

interface UsePickemsReturn {
  matchups: PickemMatchup[];
  currentWeek: number;
  totalWeeks: number;
  lockTimeGlobal?: string;
  selections: Map<string, string>;
  isLoading: boolean;
  error: string | null;
  selectTeam: (matchupId: string, teamId: string) => void;
  savePicks: () => Promise<{ success: boolean; message: string }>;
  isSaving: boolean;
  refetch: () => Promise<void>;
  // Grading fields
  weeklyScore?: WeeklyScore;
  hasSubmittedPicks?: boolean;
  isWeekComplete?: boolean;
}

export function usePickems({ leagueSlug, weekNumber }: UsePickemsOptions): UsePickemsReturn {
  const [data, setData] = useState<PickemsResponse | null>(null);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPickems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = weekNumber
        ? `/api/leagues/${leagueSlug}/pickems?week=${weekNumber}`
        : `/api/leagues/${leagueSlug}/pickems`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to load pick'ems");
      }

      const result: PickemsResponse = await response.json();
      setData(result);

      // Initialize selections from existing picks
      const initialSelections = new Map<string, string>();
      result.matchups.forEach((matchup) => {
        if (matchup.selectedTeamId) {
          initialSelections.set(matchup.id, matchup.selectedTeamId);
        }
      });
      setSelections(initialSelections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pick'ems");
    } finally {
      setIsLoading(false);
    }
  }, [leagueSlug, weekNumber]);

  useEffect(() => {
    fetchPickems();
  }, [fetchPickems]);

  const selectTeam = useCallback((matchupId: string, teamId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      // Toggle off if same team selected
      if (next.get(matchupId) === teamId) {
        next.delete(matchupId);
      } else {
        next.set(matchupId, teamId);
      }
      return next;
    });
  }, []);

  const savePicks = useCallback(async () => {
    setIsSaving(true);

    try {
      const picks = Array.from(selections.entries()).map(([matchupId, selectedTeamId]) => ({
        matchupId,
        selectedTeamId,
      }));

      const response = await fetch(`/api/leagues/${leagueSlug}/pickems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks,
          weekNumber: weekNumber || data?.currentWeek,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save picks');
      }

      const result = await response.json();

      return {
        success: result.success,
        message: result.message || `${result.savedCount}/${result.totalMatchups} picks saved`,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to save picks',
      };
    } finally {
      setIsSaving(false);
    }
  }, [selections, leagueSlug, weekNumber, data?.currentWeek]);

  return {
    matchups: data?.matchups || [],
    currentWeek: data?.currentWeek || 1,
    totalWeeks: data?.totalWeeks || 17,
    lockTimeGlobal: data?.lockTimeGlobal,
    selections,
    isLoading,
    error,
    selectTeam,
    savePicks,
    isSaving,
    refetch: fetchPickems,
    // Grading fields
    weeklyScore: data?.weeklyScore,
    hasSubmittedPicks: data?.hasSubmittedPicks,
    isWeekComplete: data?.isWeekComplete,
  };
}
