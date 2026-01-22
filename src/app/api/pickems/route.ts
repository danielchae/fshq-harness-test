import { NextResponse } from 'next/server';

import { savePicks } from '@/data/pickems/get-pickems';
import { auth } from '@/lib/auth';

// Generic pickems API endpoint for direct API calls
// This endpoint is used when no league slug is provided
// For league-specific pickems, use /api/leagues/[slug]/pickems

// GET /api/pickems - Get pickems data (default league)
export async function GET() {
  // Return empty matchups for base endpoint
  // The actual data is fetched from /api/leagues/[slug]/pickems
  return NextResponse.json({
    matchups: [],
    currentWeek: 10,
    totalWeeks: 17,
    picks: [],
  });
}

// POST /api/pickems - Attempt to submit picks
// Validates user is authenticated and matchup lock status
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { leagueSlug, picks, weekNumber } = body;

    if (!leagueSlug) {
      return NextResponse.json({ error: 'leagueSlug is required' }, { status: 400 });
    }

    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: 'picks array is required' }, { status: 400 });
    }

    // Use real data layer to save picks - validates lock status
    const result = await savePicks({
      leagueSlug,
      weekNumber,
      picks: picks.map((p: { matchupId: string; selectedTeamId: string }) => ({
        matchupId: p.matchupId,
        selectedTeamId: p.selectedTeamId,
      })),
    });

    if (result.lockedError) {
      return NextResponse.json({ error: 'Cannot modify locked picks' }, { status: 400 });
    }

    if (result.errors.length > 0 && result.picks.length === 0) {
      return NextResponse.json({ error: result.errors.join(', ') }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      savedPicks: result.picks,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error processing pick:', error);
    return NextResponse.json({ error: 'Failed to process pick' }, { status: 500 });
  }
}

// PUT /api/pickems - Attempt to update picks (same as POST)
export async function PUT(request: Request) {
  return POST(request);
}
