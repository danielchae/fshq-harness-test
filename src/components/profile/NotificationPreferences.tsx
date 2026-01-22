'use client';

import { Bell } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import type { NotificationPreferences as NotificationPreferencesType } from '@/types/profile';

interface NotificationPreferencesProps {
  preferences: NotificationPreferencesType;
  onUpdate: (preferences: Partial<NotificationPreferencesType>) => Promise<void>;
}

const notificationSettings = [
  {
    key: 'pickReminders' as const,
    label: 'Pick Reminders',
    description: 'Get reminded before pick deadlines',
  },
  {
    key: 'leagueUpdates' as const,
    label: 'League Updates',
    description: 'Receive updates about league activity',
  },
];

export function NotificationPreferences({ preferences, onUpdate }: NotificationPreferencesProps) {
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const handleToggle = async (key: keyof NotificationPreferencesType, checked: boolean) => {
    const previousValue = localPreferences[key];

    // Optimistic update
    setLocalPreferences((prev) => ({ ...prev, [key]: checked }));
    setSavingKey(key);

    try {
      await onUpdate({ [key]: checked });
      toast.success('Preference saved', {
        description: `${notificationSettings.find((s) => s.key === key)?.label} ${checked ? 'enabled' : 'disabled'}`,
      });
    } catch {
      // Revert on error
      setLocalPreferences((prev) => ({ ...prev, [key]: previousValue }));
      toast.error('Failed to save preference');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Manage how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notificationSettings.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={`notification-${setting.key}`}>{setting.label}</Label>
                <p className="text-sm text-muted-foreground">{setting.description}</p>
              </div>
              <Switch
                id={`notification-${setting.key}`}
                aria-label={`Toggle ${setting.label}`}
                checked={localPreferences[setting.key]}
                onCheckedChange={(checked) => handleToggle(setting.key, checked)}
                disabled={savingKey === setting.key}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
