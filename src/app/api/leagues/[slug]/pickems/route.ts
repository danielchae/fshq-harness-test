import { NextResponse } from 'next/server';

import { getPickems, savePicks } from '@/data/pickems/get-pickems';
import { auth } from '@/lib/auth';
import { checkLeaguePublicAccess } from '@/lib/auth/public-access';
import { getUserRoleBySlug } from '@/lib/auth/rls-policies';

import type { SavePicksResult } from '@/data/pickems/get-pickems';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/pickems - Get pickems data for a league
// Allows public access for public leagues (read-only)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Check if league is public
    const publicAccess = await checkLeaguePublicAccess(slug);

    if (!publicAccess.exists) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Get session (may be null for public visitors)
    const session = await auth();
    const userId = session?.user?.id;

    // If league is private, require authentication and membership
    if (!publicAccess.isPublic) {
      if (!userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      const role = await getUserRoleBySlug(userId, slug);
      if (!role) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

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
// Requires authentication and league membership
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // POST requires authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check league membership
    const role = await getUserRoleBySlug(session.user.id, slug);
    if (!role) {
      return NextResponse.json({ error: 'Must be a league member to submit picks' }, { status: 403 });
    }

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
