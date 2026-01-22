import { NextResponse } from 'next/server';

import { syncLeague } from '@/data/sync/sync-league';
import { auth } from '@/lib/auth';

import type { SyncResult } from '@/types/sync';

export async function POST(request: Request): Promise<NextResponse<SyncResult>> {
  try {
    // Get authenticated user session
    const session = await auth();
    const userId = session?.user?.id;

    const body = await request.json();
    const { sleeperLeagueId, sleeperUserId } = body;

    if (!sleeperLeagueId) {
      return NextResponse.json(
        {
          success: false,
          error: 'sleeperLeagueId is required',
        },
        { status: 400 }
      );
    }

    // Pass userId to syncLeague for commissioner assignment
    const result = await syncLeague({
      sleeperLeagueId,
      sleeperUserId,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed completely',
      },
      { status: 500 }
    );
  }
}
