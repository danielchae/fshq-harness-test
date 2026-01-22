import { NextResponse } from 'next/server';

import { getLeaderboard } from '@/data/leaderboard/get-leaderboard';
import { auth } from '@/lib/auth';
import { checkLeaguePublicAccess } from '@/lib/auth/public-access';
import { getUserRoleBySlug } from '@/lib/auth/rls-policies';

import type { LeaderboardRoleFilter, LeaderboardScope } from '@/types/leaderboard';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/leaderboard - Get league leaderboard
// Allows public access for public leagues
export async function GET(request: Request, { params }: RouteParams) {
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

  const scope = (searchParams.get('scope') as LeaderboardScope) || 'season';
  const roleFilter = (searchParams.get('role') as LeaderboardRoleFilter) || 'all';
  const weekParam = searchParams.get('week');
  const weekNumber = weekParam ? parseInt(weekParam, 10) : undefined;

  try {
    const data = await getLeaderboard({
      leagueSlug: slug,
      scope,
      roleFilter,
      weekNumber,
    });

    // Return array directly per test contract (standings with userName, not username)
    const standings = data.standings.map((entry, index) => ({
      rank: entry.rank || index + 1,
      userId: entry.userId,
      userName: entry.username, // Test expects userName, not username
      wins: entry.wins,
      losses: entry.losses,
      avatarUrl: entry.avatarUrl,
      teamName: entry.teamName,
      accuracy: entry.accuracy,
    }));

    return NextResponse.json(standings);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
