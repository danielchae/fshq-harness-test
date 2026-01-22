import { NextResponse } from 'next/server';

import { getFeed } from '@/data/feed/get-feed';
import { auth } from '@/lib/auth';
import { checkLeaguePublicAccess } from '@/lib/auth/public-access';
import { getUserRoleBySlug } from '@/lib/auth/rls-policies';

import type { FeedSortOption, MomentType } from '@/types/feed';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/feed - Get league feed
// Allows public access for public leagues
export async function GET(request: Request, context: RouteContext) {
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

  const { searchParams } = new URL(request.url);

  const cursor = searchParams.get('cursor') || undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const sortParam = searchParams.get('sort');
  const sort = sortParam === 'recent' || sortParam === 'chronological' ? (sortParam as FeedSortOption) : undefined;
  const typeParam = searchParams.get('type');
  const type = typeParam as MomentType | undefined;

  try {
    const data = await getFeed({ leagueSlug: slug, cursor, limit, sort, type });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}
