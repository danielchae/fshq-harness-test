'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface VisibilityToggleProps {
  leagueSlug: string;
  initialVisibility: 'public' | 'private';
  onUpdate?: (visibility: 'public' | 'private') => void;
}

export function VisibilityToggle({ leagueSlug, initialVisibility, onUpdate }: VisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialVisibility === 'public');
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    const newVisibility = checked ? 'public' : 'private';
    const previousValue = isPublic;

    // Optimistic update
    setIsPublic(checked);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (!response.ok) {
        throw new Error('Failed to update visibility');
      }

      toast.success('Visibility settings saved', {
        description: `Your league is now ${newVisibility}.`,
      });

      onUpdate?.(newVisibility);
    } catch {
      // Revert on error
      setIsPublic(previousValue);
      toast.error('Failed to save visibility settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card data-testid="visibility-toggle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isPublic ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          League Visibility
        </CardTitle>
        <CardDescription>Control whether your league is discoverable and viewable by non-members.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="visibility-switch">{isPublic ? 'Public League' : 'Private League'}</Label>
            <p className="text-sm text-muted-foreground">
              {isPublic ? 'Anyone can find and view your league.' : 'Only members can view league content.'}
            </p>
          </div>
          <Switch
            id="visibility-switch"
            aria-label="Toggle visibility"
            checked={isPublic}
            onCheckedChange={handleToggle}
            disabled={isSaving}
          />
        </div>
      </CardContent>
    </Card>
  );
}
