import { NextResponse } from 'next/server';

import { lookupLeaguesByUsername } from '@/data/sleeper/lookup-leagues';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username is required', code: 'INVALID_USERNAME' }, { status: 400 });
  }

  try {
    // Calls real Sleeper API via integration layer
    const result = await lookupLeaguesByUsername({ username });

    return NextResponse.json({
      leagues: result.leagues,
      user: result.user,
    });
  } catch (error) {
    console.error('Error fetching Sleeper leagues:', error);
    return NextResponse.json({ error: 'Failed to fetch leagues', code: 'UNKNOWN' }, { status: 500 });
  }
}
