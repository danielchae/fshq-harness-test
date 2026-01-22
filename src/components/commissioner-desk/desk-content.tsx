'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePublish } from '@/hooks/use-publish';
import { AutosaveIndicator } from './autosave-indicator';
import { MatchupPredictionsEditor } from './matchup-predictions';
import { PostsEditor } from './posts-editor';
import { PowerRankingsEditor } from './power-rankings';
import { PublishButton, PublishConfirmationModal, ValidationAlert } from './publish';
import { SeasonSelector } from './season-selector';
import { WeekSelector } from './week-selector';

import type { DeskDraft, Season, Week } from '@/data/desk/get-desk-data';
import type { PublishResponse } from '@/types/publish';
import type { AutosaveStatus } from './autosave-indicator';

interface DeskContentProps {
  leagueSlug: string;
  seasons: Season[];
  weeks: Week[];
  initialSeason: Season;
  initialWeek: number;
  initialDrafts: DeskDraft[];
}

export function DeskContent({
  leagueSlug,
  seasons,
  weeks,
  initialSeason,
  initialWeek,
  initialDrafts,
}: DeskContentProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState(initialSeason.id);
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [activeTab, setActiveTab] = useState<string>('power-rankings');
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<string | undefined>();
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);

  // Store content for each tab
  const [content, setContent] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    initialDrafts.forEach((draft) => {
      initial[draft.type] = draft.content;
    });
    return initial;
  });

  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Publish hook
  const { isValidating, isPublishing, validationErrors, publish, clearErrors } = usePublish({
    leagueSlug,
    seasonId: selectedSeasonId,
    weekNumber: selectedWeek,
    onValidationError: (errors) => {
      // Validation errors are displayed via ValidationAlert
    },
    onPublishSuccess: (result) => {
      setPublishResult(result);
      setShowConfirmationModal(true);
      toast.success('Content published successfully!');
    },
    onPublishError: (error) => {
      toast.error(error || 'Failed to publish content');
    },
  });

  // Handle publish click
  const handlePublish = useCallback(async () => {
    clearErrors();
    await publish();
  }, [publish, clearErrors]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent((prev) => ({ ...prev, [activeTab]: newContent }));

      // Clear existing timeout
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      // Set saving status
      setAutosaveStatus('saving');

      // Debounced autosave after 3 seconds of no typing
      autosaveTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch('/api/desk/autosave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leagueSlug,
              seasonId: selectedSeasonId,
              weekNumber: selectedWeek,
              type: activeTab,
              content: newContent,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setLastSaved(data.lastSaved);
            setAutosaveStatus('saved');
          } else {
            setAutosaveStatus('error');
          }
        } catch {
          setAutosaveStatus('error');
        }
      }, 3000);
    },
    [activeTab, leagueSlug, selectedSeasonId, selectedWeek]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  const handleSeasonChange = (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    // Reset content when season changes
    setContent({});
    setAutosaveStatus('idle');
  };

  const handleWeekChange = (weekNumber: number) => {
    setSelectedWeek(weekNumber);
    // Reset content when week changes
    setContent({});
    setAutosaveStatus('idle');
  };

  return (
    <div className="space-y-6">
      {/* Header with selectors, autosave indicator, and publish button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <SeasonSelector seasons={seasons} selectedSeasonId={selectedSeasonId} onSeasonChange={handleSeasonChange} />
          <WeekSelector weeks={weeks} selectedWeek={selectedWeek} onWeekChange={handleWeekChange} />
        </div>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={autosaveStatus} lastSaved={lastSaved} />
          <PublishButton onClick={handlePublish} isPublishing={isPublishing} isValidating={isValidating} />
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div data-testid="validation-feedback">
          <ValidationAlert errors={validationErrors} onDismiss={clearErrors} />
        </div>
      )}

      {/* Content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="power-rankings">Power Rankings</TabsTrigger>
          <TabsTrigger value="matchup-predictions">Matchup Predictions</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
        </TabsList>
        <TabsContent value="power-rankings" className="mt-4">
          <PowerRankingsEditor
            leagueSlug={leagueSlug}
            weekNumber={selectedWeek}
            onSaveStatusChange={setAutosaveStatus}
            onLastSavedChange={setLastSaved}
          />
        </TabsContent>
        <TabsContent value="matchup-predictions" className="mt-4">
          <MatchupPredictionsEditor
            leagueSlug={leagueSlug}
            weekNumber={selectedWeek}
            onSaveStatusChange={setAutosaveStatus}
            onLastSavedChange={setLastSaved}
          />
        </TabsContent>
        <TabsContent value="posts" className="mt-4">
          <PostsEditor
            leagueSlug={leagueSlug}
            weekNumber={selectedWeek}
            seasonId={selectedSeasonId}
            onSaveStatusChange={setAutosaveStatus}
            onLastSavedChange={setLastSaved}
          />
        </TabsContent>
      </Tabs>

      {/* Publish confirmation modal */}
      <PublishConfirmationModal
        open={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        result={publishResult}
      />
    </div>
  );
}
