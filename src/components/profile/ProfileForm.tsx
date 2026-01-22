'use client';

import { Check, Loader2, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { ProfileUpdateInput, UserProfile } from '@/types/profile';

interface ProfileFormProps {
  profile: UserProfile;
  onUpdate: (data: ProfileUpdateInput) => Promise<void>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function ProfileForm({ profile, onUpdate }: ProfileFormProps) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if there are unsaved changes
  const hasChanges = name !== profile.name || bio !== (profile.bio || '');

  // Clear saved status after 3 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveStatus]);

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setSaveStatus('saving');
    try {
      const updates: ProfileUpdateInput = {};
      if (name !== profile.name) updates.name = name;
      if (bio !== (profile.bio || '')) updates.bio = bio;

      await onUpdate(updates);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [hasChanges, name, bio, profile.name, profile.bio, onUpdate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              aria-label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-bio">Bio</Label>
            <Input
              id="profile-bio"
              aria-label="Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={!hasChanges || saveStatus === 'saving'}>
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-destructive">Failed to save. Please try again.</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
