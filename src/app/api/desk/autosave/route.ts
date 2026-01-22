import { NextResponse } from 'next/server';

import { saveDeskDraft } from '@/data/desk/get-desk-data';

import type { SaveDeskDraftInput } from '@/data/desk/get-desk-data';

// Uses real saveDeskDraft data layer with Prisma persistence
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveDeskDraftInput;

    if (!body.leagueSlug || !body.seasonId || !body.weekNumber || !body.type) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const result = await saveDeskDraft(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Autosave error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
  }
}
