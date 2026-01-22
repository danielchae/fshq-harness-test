import { NextResponse } from 'next/server';

import { getUserStats } from '@/data/leaderboard/get-user-stats';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueSlug = searchParams.get('leagueSlug') || 'test-league';

  try {
    const data = await getUserStats({
      leagueSlug,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 });
  }
}
