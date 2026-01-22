import { NextResponse } from 'next/server';

import { checkLeagueExists } from '@/data/leagues/check-exists';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sleeperLeagueId = searchParams.get('sleeper_league_id');

  if (!sleeperLeagueId) {
    return NextResponse.json({ error: 'sleeper_league_id is required', exists: false }, { status: 400 });
  }

  try {
    const result = await checkLeagueExists({ sleeperLeagueId });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking league existence:', error);
    return NextResponse.json({ error: 'Failed to check league', exists: false }, { status: 500 });
  }
}
