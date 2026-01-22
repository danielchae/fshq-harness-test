'use client';

import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useMatchupPredictions } from '@/hooks/use-matchup-predictions';
import { MatchupPredictionCard } from './matchup-prediction-card';
import { MatchupPreviewModal } from './matchup-preview-modal';

import type { AutosaveStatus } from '../autosave-indicator';

interface MatchupPredictionsEditorProps {
  leagueSlug: string;
  weekNumber: number;
  onSaveStatusChange: (status: AutosaveStatus) => void;
  onLastSavedChange: (lastSaved: string | undefined) => void;
}

export function MatchupPredictionsEditor({
  leagueSlug,
  weekNumber,
  onSaveStatusChange,
  onLastSavedChange,
}: MatchupPredictionsEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  const { predictions, isLoading, error, lastSaved, toggleFeatured, updateHypeText } = useMatchupPredictions({
    leagueSlug,
    weekNumber,
    onSaveStatusChange: (status) => {
      onSaveStatusChange(status);
    },
  });

  // Update parent when lastSaved changes
  useEffect(() => {
    onLastSavedChange(lastSaved);
  }, [lastSaved, onLastSavedChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading matchups...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with preview button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Matchup Predictions</h3>
          <p className="text-sm text-muted-foreground">
            Select a featured matchup and add your predictions or hype text.
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowPreview(true)}>
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
      </div>

      {/* Matchup cards */}
      <div className="space-y-4">
        {predictions.map((prediction) => (
          <MatchupPredictionCard
            key={prediction.id}
            prediction={prediction}
            onFeatureToggle={toggleFeatured}
            onHypeTextChange={updateHypeText}
          />
        ))}
      </div>

      {predictions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">No matchups available for this week.</div>
      )}

      {/* Preview modal */}
      <MatchupPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        predictions={predictions}
        weekNumber={weekNumber}
      />
    </div>
  );
}
