import { NextResponse } from 'next/server';

import { getLeaderboard } from '@/data/leaderboard/get-leaderboard';

import type { LeaderboardRoleFilter, LeaderboardScope } from '@/types/leaderboard';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { slug } = await params;
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
