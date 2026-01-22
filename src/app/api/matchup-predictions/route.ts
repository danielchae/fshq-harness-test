import { NextResponse } from 'next/server';

import {
  batchUpdatePredictions,
  getMatchupPredictions,
  updatePrediction,
} from '@/data/matchup-predictions/get-matchup-predictions';

// GET /api/matchup-predictions?leagueSlug=xxx&weekNumber=1
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueSlug = searchParams.get('leagueSlug');
  const weekNumber = searchParams.get('weekNumber');

  if (!leagueSlug || !weekNumber) {
    return NextResponse.json({ error: 'Missing leagueSlug or weekNumber' }, { status: 400 });
  }

  try {
    const data = await getMatchupPredictions({
      leagueSlug,
      weekNumber: parseInt(weekNumber, 10),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching matchup predictions:', error);
    return NextResponse.json({ error: 'Failed to fetch matchup predictions' }, { status: 500 });
  }
}

// PATCH /api/matchup-predictions - Update a single prediction
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { leagueSlug, weekNumber, matchupId, ...updates } = body;

    if (!leagueSlug || !weekNumber || !matchupId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = await updatePrediction({
      leagueSlug,
      weekNumber,
      matchupId,
      ...updates,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating matchup prediction:', error);
    return NextResponse.json({ error: 'Failed to update matchup prediction' }, { status: 500 });
  }
}

// PUT /api/matchup-predictions - Batch update predictions
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { leagueSlug, weekNumber, predictions } = body;

    if (!leagueSlug || !weekNumber || !predictions) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = await batchUpdatePredictions({
      leagueSlug,
      weekNumber,
      predictions,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error batch updating matchup predictions:', error);
    return NextResponse.json({ error: 'Failed to batch update matchup predictions' }, { status: 500 });
  }
}
