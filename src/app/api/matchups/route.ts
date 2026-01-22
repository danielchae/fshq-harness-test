import { NextResponse } from 'next/server';

import { getMatchups } from '@/data/matchups/get-matchups';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueSlug = searchParams.get('leagueSlug');
  const weekNumberParam = searchParams.get('weekNumber');

  if (!leagueSlug) {
    return NextResponse.json({ error: 'Missing leagueSlug parameter' }, { status: 400 });
  }

  const weekNumber = weekNumberParam ? parseInt(weekNumberParam, 10) : undefined;

  try {
    const data = await getMatchups({ leagueSlug, weekNumber });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching matchups:', error);
    return NextResponse.json({ error: 'Failed to fetch matchups' }, { status: 500 });
  }
}
