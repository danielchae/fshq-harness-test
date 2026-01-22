'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { NotificationPreferences } from '@/components/profile/NotificationPreferences';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { StatsOverview } from '@/components/profile/StatsOverview';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import type {
  NotificationPreferences as NotificationPreferencesType,
  ProfileUpdateInput,
  UserProfileData,
} from '@/types/profile';

export function ProfileContent() {
  const [data, setData] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      const profileData = await response.json();
      setData(profileData);
    } catch {
      setError('Unable to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleProfileUpdate = useCallback(async (input: ProfileUpdateInput) => {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    const result = await response.json();

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        profile: result.profile || prev.profile,
      };
    });
  }, []);

  const handleNotificationUpdate = useCallback(async (preferences: Partial<NotificationPreferencesType>) => {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationPreferences: preferences }),
    });

    if (!response.ok) {
      throw new Error('Failed to update notification preferences');
    }

    const result = await response.json();

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notificationPreferences: result.notificationPreferences || prev.notificationPreferences,
      };
    });
  }, []);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <Card data-testid="error-message">
        <CardContent className="py-10">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Error Loading Profile</h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={fetchProfile} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ProfileHeader profile={data.profile} />
      <StatsOverview stats={data.stats} />
      <ProfileForm profile={data.profile} onUpdate={handleProfileUpdate} />
      <NotificationPreferences preferences={data.notificationPreferences} onUpdate={handleNotificationUpdate} />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats skeleton */}
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>

      {/* Form skeleton */}
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
