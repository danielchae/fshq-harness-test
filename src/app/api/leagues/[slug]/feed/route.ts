import { NextResponse } from 'next/server';

import { getFeed } from '@/data/feed/get-feed';

import type { FeedSortOption, MomentType } from '@/types/feed';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
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
