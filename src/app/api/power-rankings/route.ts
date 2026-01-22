import { NextResponse } from 'next/server';

import { getPowerRankings, updatePowerRankings, updateTeamCommentary } from '@/data/power-rankings/get-power-rankings';
import { auth } from '@/lib/auth';
import { getUserRoleBySlug, hasRolePermission } from '@/lib/auth/rls-policies';

export async function GET(request: Request) {
  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

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
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { leagueSlug, weekNumber, rankings, season } = body;

    if (!leagueSlug || !weekNumber || !rankings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check user has commissioner role in this league
    const role = await getUserRoleBySlug(session.user.id, leagueSlug);
    if (!role || !hasRolePermission(role, 'commissioner')) {
      return NextResponse.json({ error: 'Commissioner role required' }, { status: 403 });
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
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { leagueSlug, weekNumber, teamId, commentary, season } = body;

    if (!leagueSlug || !weekNumber || !teamId || commentary === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check user has commissioner role in this league
    const role = await getUserRoleBySlug(session.user.id, leagueSlug);
    if (!role || !hasRolePermission(role, 'commissioner')) {
      return NextResponse.json({ error: 'Commissioner role required' }, { status: 403 });
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
