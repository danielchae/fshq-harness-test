import { NextResponse } from 'next/server';

import { claimTeam } from '@/data/teams/claim-team';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, leagueSlug = 'test-league' } = body;

    if (!teamId) {
      return NextResponse.json({ success: false, message: 'Missing required field: teamId' }, { status: 400 });
    }

    const result = await claimTeam({
      teamId,
      userId: session.user.id,
      leagueSlug,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error claiming team:', error);
    return NextResponse.json({ success: false, message: 'Failed to claim team' }, { status: 500 });
  }
}
