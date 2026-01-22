import { NextResponse } from 'next/server';

import { publishContent, validateContent } from '@/data/desk/publish-content';

import type { PublishRequest } from '@/types/publish';

// POST /api/desk/publish - Publish all content
// Wires to publishContentAction server action with auth and transaction handling
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PublishRequest;

    if (!body.leagueSlug || !body.seasonId || !body.weekNumber) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const result = await publishContent(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json({ success: false, error: 'Failed to publish content' }, { status: 500 });
  }
}

// GET /api/desk/publish/validate - Validate content before publishing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueSlug = searchParams.get('leagueSlug');
    const weekNumber = searchParams.get('weekNumber');
    const skipSections = searchParams.get('skipSections')?.split(',') as
      | ('power-rankings' | 'matchup-predictions' | 'posts')[]
      | undefined;

    if (!leagueSlug || !weekNumber) {
      return NextResponse.json(
        { isValid: false, errors: [{ section: 'general', message: 'Missing required parameters' }] },
        { status: 400 }
      );
    }

    const result = await validateContent(leagueSlug, parseInt(weekNumber), skipSections);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { isValid: false, errors: [{ section: 'general', message: 'Validation failed' }] },
      { status: 500 }
    );
  }
}
