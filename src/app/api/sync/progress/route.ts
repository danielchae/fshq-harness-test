import { NextResponse } from 'next/server';

import { getSyncProgress } from '@/data/sync/sync-league';

import type { SyncProgressResponse } from '@/types/sync';

export async function GET(request: Request): Promise<NextResponse<SyncProgressResponse>> {
  const { searchParams } = new URL(request.url);
  const sleeperLeagueId = searchParams.get('sleeperLeagueId');

  if (!sleeperLeagueId) {
    return NextResponse.json({ progress: 0, status: 'Missing league ID' }, { status: 400 });
  }

  // Delegate to data layer for progress tracking
  // Note: Progress tracking returns simulated values during sync
  const progress = await getSyncProgress({ sleeperLeagueId });

  return NextResponse.json(progress);
}
