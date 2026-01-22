import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getPowerRankings } from '@/data/power-rankings/get-power-rankings';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/rankings - Get power rankings for a week
export async function GET(request: NextRequest, context: RouteContext) {
  // Check authentication via session token cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('authjs.session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await context.params;
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
