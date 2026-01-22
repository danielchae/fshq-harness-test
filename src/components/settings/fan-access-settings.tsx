'use client';

import { Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface FanAccessSettingsProps {
  leagueSlug: string;
  initialEnabled: boolean;
  initialFanLimit: number | null;
  currentFanCount: number;
  onUpdate?: (enabled: boolean, limit: number | null) => void;
}

export function FanAccessSettings({
  leagueSlug,
  initialEnabled,
  initialFanLimit,
  currentFanCount,
  onUpdate,
}: FanAccessSettingsProps) {
  const [fanAccessEnabled, setFanAccessEnabled] = useState(initialEnabled);
  const [fanLimit, setFanLimit] = useState<number | null>(initialFanLimit);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    const previousEnabled = fanAccessEnabled;

    // Optimistic update
    setFanAccessEnabled(checked);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fanAccessEnabled: checked }),
      });

      if (!response.ok) {
        throw new Error('Failed to update fan access');
      }

      toast.success('Fan access settings saved', {
        description: checked ? 'Fans can now join your league.' : 'Fan registration is now disabled.',
      });

      onUpdate?.(checked, fanLimit);
    } catch {
      // Revert on error
      setFanAccessEnabled(previousEnabled);
      toast.error('Failed to save fan access settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLimitChange = async (value: string) => {
    const newLimit = value === '' ? null : parseInt(value, 10);
    if (value !== '' && isNaN(newLimit as number)) return;

    const previousLimit = fanLimit;
    setFanLimit(newLimit);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fanLimit: newLimit }),
      });

      if (!response.ok) {
        throw new Error('Failed to update fan limit');
      }

      toast.success('Fan limit saved');
      onUpdate?.(fanAccessEnabled, newLimit);
    } catch {
      setFanLimit(previousLimit);
      toast.error('Failed to save fan limit');
    }
  };

  return (
    <Card data-testid="fan-access-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Fan Access
        </CardTitle>
        <CardDescription>Control whether fans can join your league and set capacity limits.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="fan-access-switch">{fanAccessEnabled ? 'Fan Access Enabled' : 'Fan Access Disabled'}</Label>
            <p className="text-sm text-muted-foreground">
              {fanAccessEnabled ? 'Non-managers can request fan roles.' : 'Only manager roles are available.'}
            </p>
          </div>
          <Switch
            id="fan-access-switch"
            aria-label="Toggle fan access"
            checked={fanAccessEnabled}
            onCheckedChange={handleToggle}
            disabled={isSaving}
          />
        </div>

        {fanAccessEnabled && (
          <>
            <div className="h-px bg-border" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="fan-limit">Fan Limit</Label>
                <span className="text-sm text-muted-foreground">Current: {currentFanCount} fans</span>
              </div>
              <Input
                id="fan-limit"
                type="number"
                min={currentFanCount}
                placeholder="Unlimited"
                value={fanLimit ?? ''}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="max-w-[150px]"
              />
              <p className="text-xs text-muted-foreground">Leave empty for unlimited fans.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
