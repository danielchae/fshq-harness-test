'use client';

import { UserCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface JoinRulesToggleProps {
  leagueSlug: string;
  initialJoinRule: 'auto-join' | 'approval-required';
  onUpdate?: (joinRule: 'auto-join' | 'approval-required') => void;
}

export function JoinRulesToggle({ leagueSlug, initialJoinRule, onUpdate }: JoinRulesToggleProps) {
  const [isAutoJoin, setIsAutoJoin] = useState(initialJoinRule === 'auto-join');
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    const newJoinRule = checked ? 'auto-join' : 'approval-required';
    const previousValue = isAutoJoin;

    // Optimistic update
    setIsAutoJoin(checked);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinRule: newJoinRule }),
      });

      if (!response.ok) {
        throw new Error('Failed to update join rules');
      }

      toast.success('Join rules saved', {
        description: checked ? 'New members can now join automatically.' : 'New members will require your approval.',
      });

      onUpdate?.(newJoinRule);
    } catch {
      // Revert on error
      setIsAutoJoin(previousValue);
      toast.error('Failed to save join rules');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card data-testid="join-rule-toggle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isAutoJoin ? <UserPlus className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
          Join Rules
        </CardTitle>
        <CardDescription>Control how new members join your league.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="join-rule-switch">{isAutoJoin ? 'Auto-Join Enabled' : 'Approval Required'}</Label>
            <p className="text-sm text-muted-foreground">
              {isAutoJoin
                ? 'Users can join immediately after selecting a role.'
                : 'You must approve each member before they can join.'}
            </p>
          </div>
          <Switch
            id="join-rule-switch"
            aria-label="Toggle join rules"
            checked={isAutoJoin}
            onCheckedChange={handleToggle}
            disabled={isSaving}
          />
        </div>
      </CardContent>
    </Card>
  );
}
