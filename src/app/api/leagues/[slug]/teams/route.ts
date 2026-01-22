import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getTeams } from '@/data/teams/get-teams';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  // Check authentication via session token cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('authjs.session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const teams = await getTeams({ leagueSlug: slug });

    // Transform to match the expected API response format
    // E2E tests expect flat wins/losses/ties properties and managerId
    const transformedTeams = teams.map((team) => ({
      id: team.id,
      name: team.name,
      managerId: team.managerId,
      sleeperUsername: team.sleeperUsername,
      ownerUsername: team.ownerUsername,
      avatarUrl: team.avatarUrl,
      wins: team.record.wins,
      losses: team.record.losses,
      ties: team.record.ties,
      record: team.record,
      claimed: team.isClaimed,
      claimedBy: team.claimedBy,
    }));

    return NextResponse.json(transformedTeams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
