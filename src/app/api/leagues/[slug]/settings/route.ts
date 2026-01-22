import { NextRequest, NextResponse } from 'next/server';

import { getLeagueSettings, updateLeagueSettings } from '@/data/settings/get-league-settings';
import { AuthorizationError, checkRole } from '@/lib/auth/rbac';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    // Require commissioner role for settings access
    const hasAccess = await checkRole('commissioner');
    if (!hasAccess) {
      throw new AuthorizationError('Unauthorized: commissioner role required');
    }

    const settings = await getLeagueSettings({ slug });

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    // Require commissioner role for settings updates
    const hasAccess = await checkRole('commissioner');
    if (!hasAccess) {
      throw new AuthorizationError('Unauthorized: commissioner role required');
    }

    const updates = await request.json();

    const updatedSettings = await updateLeagueSettings({ slug, updates });

    if (!updatedSettings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    // Require commissioner role for settings updates
    const hasAccess = await checkRole('commissioner');
    if (!hasAccess) {
      throw new AuthorizationError('Unauthorized: commissioner role required');
    }

    const updates = await request.json();

    const updatedSettings = await updateLeagueSettings({ slug, updates });

    if (!updatedSettings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
