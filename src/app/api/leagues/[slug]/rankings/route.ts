import { NextRequest, NextResponse } from 'next/server';

import { getPowerRankings } from '@/data/power-rankings/get-power-rankings';
import { auth } from '@/lib/auth';
import { checkLeaguePublicAccess, getPublicContentSettings } from '@/lib/auth/public-access';
import { getUserRoleBySlug } from '@/lib/auth/rls-policies';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/rankings - Get power rankings for a week
// Allows public access for public leagues (if rankings are enabled in public content)
export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

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
  } else if (!userId) {
    // Public visitor - check if rankings are enabled for public viewing
    const publicContent = await getPublicContentSettings(slug);
    if (!publicContent?.rankings) {
      return NextResponse.json({ error: 'Rankings are not publicly visible' }, { status: 403 });
    }
  }
  const { searchParams } = new URL(request.url);

  // Get week parameter, default to most recent week (3)
  const weekParam = searchParams.get('week');
  const weekNumber = weekParam ? parseInt(weekParam, 10) : 3;

  // Validate week number
  if (isNaN(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: 'Invalid week number. Must be 1 or greater.' }, { status: 400 });
  }

  try {
    // Use real data layer to get power rankings
    const rankingsData = await getPowerRankings({ leagueSlug: slug, weekNumber });

    // Transform to match expected E2E test format
    // E2E expects: direct array with teamId, rank, commentary per ranking
    const transformedRankings = rankingsData.rankings.map((ranking) => ({
      id: ranking.id,
      teamId: ranking.teamId,
      teamName: ranking.teamName,
      ownerUsername: ranking.ownerUsername,
      avatarUrl: ranking.avatarUrl,
      record: ranking.record,
      rank: ranking.rank,
      previousRank: ranking.previousRank,
      commentary: ranking.commentary,
    }));

    // Return array directly as expected by E2E tests
    return NextResponse.json(transformedRankings);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }
}
