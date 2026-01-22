import { NextResponse } from 'next/server';

import { getRankingsHistory } from '@/data/power-rankings/get-rankings-history';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueSlug = searchParams.get('leagueSlug');

  if (!leagueSlug) {
    return NextResponse.json({ error: 'Missing required parameter: leagueSlug' }, { status: 400 });
  }

  const data = await getRankingsHistory({ leagueSlug });

  return NextResponse.json(data);
}
