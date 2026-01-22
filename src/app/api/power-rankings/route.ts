import { NextResponse } from 'next/server';

import { getPowerRankings, updatePowerRankings, updateTeamCommentary } from '@/data/power-rankings/get-power-rankings';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueSlug = searchParams.get('leagueSlug');
  const weekNumber = searchParams.get('weekNumber');
  const season = searchParams.get('season');

  if (!leagueSlug || !weekNumber) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const data = await getPowerRankings({
    leagueSlug,
    weekNumber: parseInt(weekNumber, 10),
    season: season ? parseInt(season, 10) : undefined,
  });

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { leagueSlug, weekNumber, rankings, season } = body;

    if (!leagueSlug || !weekNumber || !rankings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Default to current year if season not provided
    const seasonValue = season ?? new Date().getFullYear();

    const data = await updatePowerRankings({
      leagueSlug,
      weekNumber,
      season: seasonValue,
      rankings,
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to update rankings' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { leagueSlug, weekNumber, teamId, commentary, season } = body;

    if (!leagueSlug || !weekNumber || !teamId || commentary === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Default to current year if season not provided
    const seasonValue = season ?? new Date().getFullYear();

    const data = await updateTeamCommentary({
      leagueSlug,
      weekNumber,
      season: seasonValue,
      teamId,
      commentary,
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to update commentary' }, { status: 500 });
  }
}
