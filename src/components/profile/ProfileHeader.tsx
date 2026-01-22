'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { getAvatarWithGravatarFallback, getInitials } from '@/lib/gravatar';

import type { UserProfile } from '@/types/profile';

interface ProfileHeaderProps {
  profile: UserProfile;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const avatarSrc = getAvatarWithGravatarFallback(profile.avatarUrl, profile.email, { size: 160 });

  return (
    <Card data-testid="profile-header">
      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20" data-testid="user-avatar">
            <AvatarImage src={avatarSrc} alt={profile.name} />
            <AvatarFallback className="text-lg">{getInitials(profile.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold" data-testid="user-name">
              {profile.name}
            </h1>
            <p className="text-muted-foreground" data-testid="user-email">
              {profile.email}
            </p>
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
