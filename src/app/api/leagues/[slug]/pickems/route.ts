import { NextResponse } from 'next/server';

import { getPickems, savePicks } from '@/data/pickems/get-pickems';

import type { SavePicksResult } from '@/data/pickems/get-pickems';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/pickems - Get pickems data for a league
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week');
    const weekNumber = weekParam ? parseInt(weekParam, 10) : undefined;

    const data = await getPickems({
      leagueSlug: slug,
      weekNumber,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching pickems:', error);
    return NextResponse.json({ error: 'Failed to fetch pickems' }, { status: 500 });
  }
}

// POST /api/leagues/[slug]/pickems - Save picks
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { picks, week } = body;

    if (!picks || !Array.isArray(picks)) {
      return NextResponse.json({ error: 'Invalid picks data' }, { status: 400 });
    }

    const result: SavePicksResult = await savePicks({
      leagueSlug: slug,
      weekNumber: week,
      picks: picks.map((p: { matchupId: string; teamId: string }) => ({
        matchupId: p.matchupId,
        selectedTeamId: p.teamId,
      })),
    });

    // If any picks are locked, return 400 with error
    if (result.lockedError) {
      return NextResponse.json({ error: 'Picks are locked' }, { status: 400 });
    }

    return NextResponse.json({ picks: result.picks });
  } catch (error) {
    console.error('Error saving picks:', error);
    return NextResponse.json({ error: 'Failed to save picks' }, { status: 500 });
  }
}
