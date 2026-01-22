import { NextResponse } from 'next/server';

import { getBracket } from '@/data/brackets/get-brackets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueSlug = searchParams.get('leagueSlug');
    const season = searchParams.get('season');

    if (!leagueSlug) {
      return NextResponse.json({ error: 'leagueSlug parameter is required' }, { status: 400 });
    }

    const data = await getBracket({
      leagueSlug,
      season: season ? parseInt(season, 10) : undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bracket data:', error);
    return NextResponse.json({ error: 'Failed to fetch bracket data' }, { status: 500 });
  }
}
