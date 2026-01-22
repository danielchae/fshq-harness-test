import { NextResponse } from 'next/server';

import { saveDeskDraft } from '@/data/desk/get-desk-data';
import { auth } from '@/lib/auth';
import { getUserRoleBySlug, hasRolePermission } from '@/lib/auth/rls-policies';

import type { SaveDeskDraftInput } from '@/data/desk/get-desk-data';

// Uses real saveDeskDraft data layer with Prisma persistence
export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json()) as SaveDeskDraftInput;

    if (!body.leagueSlug || !body.seasonId || !body.weekNumber || !body.type) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Check user has commissioner role in this league
    const role = await getUserRoleBySlug(session.user.id, body.leagueSlug);
    if (!role || !hasRolePermission(role, 'commissioner')) {
      return NextResponse.json({ success: false, error: 'Commissioner role required' }, { status: 403 });
    }

    const result = await saveDeskDraft(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Autosave error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
  }
}
