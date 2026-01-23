'use client';

import { useCallback, useEffect, useState } from 'react';

import { NFL_TOTAL_WEEKS } from '@/lib/nfl-week';

import type { PickemMatchup, PickemsResponse, PickemsSeasonState, WeeklyScore } from '@/types/pickems';

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
  // Season state fields (new)
  seasonState?: PickemsSeasonState;
  selectedWeek: number;
  setSelectedWeek: (week: number) => void;
  availableWeeks: number[];
}

export function usePickems({ leagueSlug, weekNumber: initialWeekNumber }: UsePickemsOptions): UsePickemsReturn {
  const [data, setData] = useState<PickemsResponse | null>(null);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track user-selected week for navigation (undefined means use server default)
  const [selectedWeek, setSelectedWeekState] = useState<number | undefined>(initialWeekNumber);

  const fetchPickems = useCallback(async (weekToFetch?: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = weekToFetch !== undefined
        ? `/api/leagues/${leagueSlug}/pickems?week=${weekToFetch}`
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
  }, [leagueSlug]);

  // Fetch when component mounts or when selected week changes
  useEffect(() => {
    fetchPickems(selectedWeek);
  }, [fetchPickems, selectedWeek]);

  // Function to change the selected week
  const setSelectedWeek = useCallback((week: number) => {
    setSelectedWeekState(week);
  }, []);

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
    // Check if picks are allowed
    if (data?.seasonState?.isSeasonComplete) {
      return {
        success: false,
        message: 'The fantasy season has ended. Picks are no longer accepted.',
      };
    }

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
          weekNumber: selectedWeek || data?.currentWeek,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save picks');
      }

      const result = await response.json();

      return {
        success: true,
        message: result.message || `${result.picks?.length || 0} picks saved`,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to save picks',
      };
    } finally {
      setIsSaving(false);
    }
  }, [selections, leagueSlug, selectedWeek, data?.currentWeek, data?.seasonState?.isSeasonComplete]);

  // Calculate available weeks for navigation
  const availableWeeks = data?.seasonState?.availableWeeks || [];

  return {
    matchups: data?.matchups || [],
    currentWeek: data?.currentWeek || 1,
    totalWeeks: data?.totalWeeks || NFL_TOTAL_WEEKS,
    lockTimeGlobal: data?.lockTimeGlobal,
    selections,
    isLoading,
    error,
    selectTeam,
    savePicks,
    isSaving,
    refetch: () => fetchPickems(selectedWeek),
    // Grading fields
    weeklyScore: data?.weeklyScore,
    hasSubmittedPicks: data?.hasSubmittedPicks,
    isWeekComplete: data?.isWeekComplete,
    // Season state fields
    seasonState: data?.seasonState,
    selectedWeek: selectedWeek ?? data?.currentWeek ?? 1,
    setSelectedWeek,
    availableWeeks,
  };
}
