import { NextResponse } from 'next/server';

import { getUserProfile, updateNotificationPreferences, updateUserProfile } from '@/data/profile/get-profile';

import type { NotificationPreferencesUpdateInput, ProfileUpdateInput } from '@/types/profile';

export async function GET() {
  try {
    const profileData = await getUserProfile();
    return NextResponse.json(profileData);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // Handle notification preferences update
    if ('notificationPreferences' in body) {
      const input: NotificationPreferencesUpdateInput = body.notificationPreferences;
      const updatedPreferences = await updateNotificationPreferences(input);
      return NextResponse.json({ notificationPreferences: updatedPreferences });
    }

    // Handle profile update
    const input: ProfileUpdateInput = body;
    const updatedProfile = await updateUserProfile(input);
    return NextResponse.json({ profile: updatedProfile });
  } catch {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
