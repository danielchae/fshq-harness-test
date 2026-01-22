import { NextResponse } from 'next/server';

import { getUserLeagues } from '@/data/leagues/get-user-leagues';
import { auth } from '@/lib/auth';

// GET /api/user/leagues - Fetch all leagues for the authenticated user
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    // If no userId, return empty array (unauthenticated)
    if (!userId) {
      return NextResponse.json([]);
    }

    const leagues = await getUserLeagues(userId);
    return NextResponse.json(leagues);
  } catch (error) {
    console.error('[API] Error fetching user leagues:', error);
    return NextResponse.json({ error: 'Failed to fetch user leagues' }, { status: 500 });
  }
}
