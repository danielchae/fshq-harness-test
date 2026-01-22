'use client';

import { Check, FileText, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface LeagueDescriptionEditorProps {
  leagueSlug: string;
  initialDescription: string;
  maxLength?: number;
  onUpdate?: (description: string) => void;
}

export function LeagueDescriptionEditor({
  leagueSlug,
  initialDescription,
  maxLength = 2000,
  onUpdate,
}: LeagueDescriptionEditorProps) {
  const [description, setDescription] = useState(initialDescription);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const saveDescription = useCallback(
    async (value: string) => {
      setSaveStatus('saving');

      try {
        const response = await fetch(`/api/leagues/${leagueSlug}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: value }),
        });

        if (!response.ok) {
          throw new Error('Failed to save description');
        }

        setSaveStatus('saved');
        onUpdate?.(value);

        // Reset status after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
        toast.error('Failed to save description');
      }
    },
    [leagueSlug, onUpdate]
  );

  const handleChange = (value: string) => {
    if (value.length > maxLength) return;

    setDescription(value);
    setSaveStatus('idle');

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce autosave (800ms after typing stops)
    debounceRef.current = setTimeout(() => {
      saveDescription(value);
    }, 800);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Card data-testid="league-description">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          League Description
        </CardTitle>
        <CardDescription>
          Describe your league's culture, rules, and community to help potential members learn more.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="league-description">Description</Label>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs ${
                description.length > maxLength * 0.9 ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {description.length} / {maxLength}
            </span>
            <div data-testid="autosave-indicator" className="flex items-center gap-1 text-xs">
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-muted-foreground">Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">Saved</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Textarea
          id="league-description"
          aria-label="League description"
          placeholder="Tell potential members about your league..."
          value={description}
          onChange={(e) => handleChange(e.target.value)}
          rows={6}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          This description is displayed on your league's landing page for both members and non-members (if public).
        </p>
      </CardContent>
    </Card>
  );
}
