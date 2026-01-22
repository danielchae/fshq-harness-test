import { NextResponse } from 'next/server';

import { validateTeamClaim } from '@/data/teams/validate-claim';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamId, userSleeperUsername, leagueSlug = 'test-league' } = body;

    if (!teamId || !userSleeperUsername) {
      return NextResponse.json(
        { valid: false, message: 'Missing required fields: teamId and userSleeperUsername' },
        { status: 400 }
      );
    }

    // Get the current user's ID from auth session
    const session = await auth();
    const userId = session?.user?.id;

    const result = await validateTeamClaim({
      teamId,
      userSleeperUsername,
      leagueSlug,
      userId, // Pass userId to validate user isn't already managing another team
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating claim:', error);
    return NextResponse.json({ valid: false, message: 'Failed to validate claim' }, { status: 500 });
  }
}
