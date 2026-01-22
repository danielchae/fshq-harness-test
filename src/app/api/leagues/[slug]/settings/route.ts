import { NextRequest, NextResponse } from 'next/server';

import { getLeagueSettings, updateLeagueSettings } from '@/data/settings/get-league-settings';
import { auth } from '@/lib/auth';
import { getUserRoleBySlug, hasRolePermission, RLSError } from '@/lib/auth/rls-policies';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check user has commissioner role in this league
    const role = await getUserRoleBySlug(session.user.id, slug);
    if (!role || !hasRolePermission(role, 'commissioner')) {
      return NextResponse.json({ error: 'Commissioner role required' }, { status: 403 });
    }

    const settings = await getLeagueSettings({ slug });

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof RLSError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check user has commissioner role in this league
    const role = await getUserRoleBySlug(session.user.id, slug);
    if (!role || !hasRolePermission(role, 'commissioner')) {
      return NextResponse.json({ error: 'Commissioner role required' }, { status: 403 });
    }

    const updates = await request.json();

    const updatedSettings = await updateLeagueSettings({ slug, updates });

    if (!updatedSettings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    if (error instanceof RLSError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check user has commissioner role in this league
    const role = await getUserRoleBySlug(session.user.id, slug);
    if (!role || !hasRolePermission(role, 'commissioner')) {
      return NextResponse.json({ error: 'Commissioner role required' }, { status: 403 });
    }

    const updates = await request.json();

    const updatedSettings = await updateLeagueSettings({ slug, updates });

    if (!updatedSettings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    if (error instanceof RLSError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
