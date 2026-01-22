import { NextRequest, NextResponse } from 'next/server';

import { getTeams } from '@/data/teams/get-teams';
import { auth } from '@/lib/auth';
import { checkLeaguePublicAccess } from '@/lib/auth/public-access';
import { getUserRoleBySlug } from '@/lib/auth/rls-policies';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/teams - Get teams for a league
// Allows public access for public leagues
export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  // Check if league is public
  const publicAccess = await checkLeaguePublicAccess(slug);

  if (!publicAccess.exists) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  // Get session (may be null for public visitors)
  const session = await auth();
  const userId = session?.user?.id;

  // If league is private, require authentication and membership
  if (!publicAccess.isPublic) {
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const role = await getUserRoleBySlug(userId, slug);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  try {
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
