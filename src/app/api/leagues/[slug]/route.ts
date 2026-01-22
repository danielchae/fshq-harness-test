import { NextRequest, NextResponse } from 'next/server';

import { getLeague } from '@/data/leagues/get-league';
import { auth } from '@/lib/auth';
import { checkLeaguePublicAccess } from '@/lib/auth/public-access';
import { getUserRoleBySlug } from '@/lib/auth/rls-policies';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug] - Get league by slug
// Allows public access for public leagues
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;

  try {
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

      // Check if user is a member
      const role = await getUserRoleBySlug(userId, slug);
      if (!role) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const league = await getLeague({ slug });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    return NextResponse.json(league);
  } catch (error) {
    console.error('Error fetching league:', error);
    return NextResponse.json({ error: 'Failed to fetch league' }, { status: 500 });
  }
}
