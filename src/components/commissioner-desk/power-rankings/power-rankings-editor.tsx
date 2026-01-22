'use client';

import { Eye } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { usePowerRankings } from '@/hooks/use-power-rankings';
import { RankingRow } from './ranking-row';
import { RankingsPreviewModal } from './rankings-preview-modal';

import type { AutosaveStatus } from '../autosave-indicator';

interface PowerRankingsEditorProps {
  leagueSlug: string;
  weekNumber: number;
  onSaveStatusChange: (status: AutosaveStatus) => void;
  onLastSavedChange: (lastSaved: string | undefined) => void;
}

export function PowerRankingsEditor({
  leagueSlug,
  weekNumber,
  onSaveStatusChange,
  onLastSavedChange,
}: PowerRankingsEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const dragNodeRef = useRef<number | null>(null);

  const { rankings, isLoading, error, lastSaved, reorderRankings, updateCommentary } = usePowerRankings({
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

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragNodeRef.current = index;
    setDraggedIndex(index);

    // Set drag data for proper drag feedback
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));

    // Add a small delay to allow the state update before visual feedback
    setTimeout(() => {
      setDraggedIndex(index);
    }, 0);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (dragNodeRef.current !== index) {
      setDropTargetIndex(index);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
      e.preventDefault();
      const fromIndex = dragNodeRef.current;
      if (fromIndex !== null && fromIndex !== targetIndex) {
        reorderRankings(fromIndex, targetIndex);
      }
    },
    [reorderRankings]
  );

  const handleDragEnd = useCallback(() => {
    // Reset drag state (reorder is handled by onDrop)
    dragNodeRef.current = null;
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleCommentaryChange = useCallback(
    (teamId: string, commentary: string) => {
      updateCommentary(teamId, commentary);
    },
    [updateCommentary]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading rankings...</div>
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
          <h3 className="text-lg font-semibold">Power Rankings</h3>
          <p className="text-sm text-muted-foreground">Drag teams to reorder. Add commentary for each team.</p>
        </div>
        <Button variant="outline" onClick={() => setShowPreview(true)}>
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
      </div>

      {/* Rankings list */}
      <div data-testid="rankings-editor-list" className="space-y-3">
        {rankings.map((ranking, index) => (
          <RankingRow
            key={ranking.id}
            ranking={ranking}
            index={index}
            isDragging={draggedIndex === index}
            isDropTarget={dropTargetIndex === index}
            onCommentaryChange={handleCommentaryChange}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Preview modal */}
      <RankingsPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        rankings={rankings}
        weekNumber={weekNumber}
      />
    </div>
  );
}
