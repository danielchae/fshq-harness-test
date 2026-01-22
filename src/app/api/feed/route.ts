import { NextResponse } from 'next/server';

import { createMoment } from '@/data/feed/create-moment';
import { getFeed } from '@/data/feed/get-feed';
import { auth } from '@/lib/auth';

import type { FeedSortOption, MomentType } from '@/types/feed';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueSlug = searchParams.get('leagueSlug') || 'test-league';
  const cursor = searchParams.get('cursor') || undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam) : undefined;
  const sortParam = searchParams.get('sort');
  const sort = sortParam === 'recent' || sortParam === 'chronological' ? (sortParam as FeedSortOption) : undefined;
  const typeParam = searchParams.get('type');
  const type = typeParam as MomentType | undefined;
  // Check if client requested cache bypass (after moderation actions)
  const noCache = searchParams.has('_t');

  try {
    const data = await getFeed({ leagueSlug, cursor, limit, sort, type, noCache });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { leagueSlug, content } = body;

    if (!content || !leagueSlug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await createMoment({
      leagueSlug,
      content,
      authorId: session.user.id,
      authorName: session.user.name || 'Unknown',
      authorAvatar: session.user.image || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.moment);
  } catch {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
