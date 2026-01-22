import { NextResponse } from 'next/server';

import { getLeagueHistory } from '@/data/history/get-league-history';
import { auth } from '@/lib/auth';
import { checkLeaguePublicAccess, getPublicContentSettings } from '@/lib/auth/public-access';
import { getUserRoleBySlug } from '@/lib/auth/rls-policies';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/history - Get league history
// Allows public access for public leagues (if history is enabled in public content)
export async function GET(_request: Request, context: RouteContext) {
  try {
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
    } else if (!userId) {
      // Public visitor - check if history is enabled for public viewing
      const publicContent = await getPublicContentSettings(slug);
      if (!publicContent?.history) {
        return NextResponse.json({ error: 'History is not publicly visible' }, { status: 403 });
      }
    }

    const data = await getLeagueHistory({ leagueSlug: slug });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching league history:', error);
    return NextResponse.json({ error: 'Failed to fetch league history' }, { status: 500 });
  }
}
