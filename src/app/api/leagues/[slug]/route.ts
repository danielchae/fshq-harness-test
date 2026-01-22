import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getLeague } from '@/data/leagues/get-league';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug] - Get league by slug
export async function GET(request: NextRequest, { params }: RouteContext) {
  // Check authentication via session token cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('authjs.session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;

  try {
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
