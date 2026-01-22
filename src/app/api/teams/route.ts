import { NextResponse } from 'next/server';

import { getTeams } from '@/data/teams/get-teams';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueSlug = searchParams.get('leagueSlug') || 'test-league';

  try {
    const teams = await getTeams({ leagueSlug });

    // Transform to match the expected API response format
    const transformedTeams = teams.map((team) => ({
      id: team.id,
      name: team.name,
      sleeperUsername: team.sleeperUsername,
      ownerUsername: team.ownerUsername,
      avatarUrl: team.avatarUrl,
      record: team.record,
      claimed: team.isClaimed,
      claimedBy: team.claimedBy,
    }));

    return NextResponse.json({ teams: transformedTeams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
